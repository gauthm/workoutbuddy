import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDb } from './src/db/database.js'
import { migrate } from './src/db/migrate.js'
import { seedExercises } from './src/seed/seed.js'
import exercisesRouter from './src/routes/exercises.js'
import equipmentRouter from './src/routes/equipment.js'
import programsRouter from './src/routes/programs.js'
import { templatesRouter, templateExercisesRouter } from './src/routes/templates.js'
import sessionsRouter from './src/routes/sessions.js'
import setsRouter from './src/routes/sets.js'
import statsRouter from './src/routes/stats.js'
import bodyweightRouter from './src/routes/bodyweight.js'
import settingsRouter from './src/routes/settings.js'
import userProfileRouter from './src/routes/userProfile.js'
import aiRouter from './src/routes/ai.js'
import exportImportRouter from './src/routes/exportImport.js'
import { scheduleWeeks } from './src/services/sessionScheduler.js'
import { securityConfig, securityHeaders, sameOriginApi, rateLimit, expensiveRequests } from './src/services/httpSecurity.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const security = securityConfig()
app.disable('x-powered-by')
app.set('trust proxy', security.trustProxy)
app.use(securityHeaders(security))
app.use('/api', sameOriginApi(security), rateLimit({limit: 600}))
app.use('/api/v1', expensiveRequests())

app.use('/api/v1/import', express.json({ limit: '20mb', inflate: false }))
app.use(express.json({ limit: '100kb', inflate: false }))
app.use(express.static(path.join(__dirname, 'public')))

// ── Route registration ──────────
app.use('/api/v1/settings',    settingsRouter)
app.use('/api/v1/exercises', exercisesRouter)
app.use('/api/v1/equipment', equipmentRouter)
app.use('/api/v1/programs', programsRouter)
app.use('/api/v1/templates', templatesRouter)
app.use('/api/v1/template-exercises', templateExercisesRouter)
app.use('/api/v1/sessions', sessionsRouter)
app.use('/api/v1', setsRouter)
app.use('/api/v1/stats',       statsRouter)
app.use('/api/v1/bodyweight',  bodyweightRouter)
app.use('/api/v1/user-profile', userProfileRouter)
app.use('/api/v1/ai', aiRouter)
app.use('/api/v1', exportImportRouter)

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  if (path.extname(req.path)) return res.status(404).end()
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'NOT_FOUND' }))
app.use((err, _req, res, _next) => {
  if (res.headersSent) return _next(err)
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'INVALID_JSON' })
  if (err.status === 415) return res.status(415).json({ error: 'UNSUPPORTED_ENCODING' })
  console.error('[HTTP]', err.message)
  res.status(500).json({ error: 'INTERNAL_ERROR' })
})

// ── Startup ─────────────────────────────────────────────────
let httpServer
let stopping = false

function shutdown() {
  if (stopping) return
  stopping = true
  const finish = () => {
    getDb().close()
    process.exit(0)
  }
  if (!httpServer) return finish()
  httpServer.close(finish)
  httpServer.closeIdleConnections()
  // Bound long-lived AI streams while allowing ordinary requests to finish.
  setTimeout(() => { httpServer.closeAllConnections() }, 25_000).unref()
}

async function bootstrap() {
  const db = getDb()
  migrate(db)
  seedExercises(db)

  try {
    const scheduled = scheduleWeeks(db)
    if (scheduled > 0) {
      console.log(`[scheduler] ${scheduled} session(s) scheduled at startup`)
    }
  } catch (err) {
    console.warn('[scheduler] Startup scheduling error:', err.message)
    // Non-blocking
  }

  // Precedence: environment variables > settings table > defaults
  const portRow = db.prepare("SELECT value FROM settings WHERE key='network_port'").get()
  const hostRow = db.prepare("SELECT value FROM settings WHERE key='network_host'").get()
  const port = process.env.PORT ? Number(process.env.PORT)
    : portRow ? JSON.parse(portRow.value) : 3000
  const host = process.env.HOST || (hostRow ? JSON.parse(hostRow.value) : '127.0.0.1')

  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid network port.')
  await new Promise((resolve, reject) => {
    const server = app.listen(port, host, resolve)
    httpServer = server
    server.requestTimeout = 60_000
    server.headersTimeout = 15_000
    server.keepAliveTimeout = 5_000
    server.maxHeadersCount = 100
    server.once('error', reject)
  })
  console.log(`WorkoutBuddy started → http://${host}:${port}`)
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
  bootstrap().catch(err => {
    console.error('Startup error:', err.message)
    process.exit(1)
  })
}

export { app } // for supertest
