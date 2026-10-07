import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDb } from './src/db/database.js'
import { migrate } from './src/db/migrate.js'
import { seedExercises } from './src/seed/seed.js'
import exercisesRouter from './src/routes/exercises.js'
import equipmentRouter from './src/routes/equipment.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// ── Montage des routes (à compléter tâche par tâche) ──────────
app.use('/api/v1/exercises', exercisesRouter)
app.use('/api/v1/equipment', equipmentRouter)

// ── Fallback SPA ──────────────────────────────────────────────
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// ── Démarrage ─────────────────────────────────────────────────
async function bootstrap() {
  const db = getDb()
  migrate(db)
  seedExercises(db)

  // Lire host et port depuis les settings (table créée par migrate)
  const portRow = db.prepare("SELECT value FROM settings WHERE key='network_port'").get()
  const hostRow = db.prepare("SELECT value FROM settings WHERE key='network_host'").get()
  const port = portRow ? JSON.parse(portRow.value) : 3000
  const host = hostRow ? JSON.parse(hostRow.value) : '127.0.0.1'

  app.listen(port, host, () => {
    console.log(`WorkoutBuddy démarré → http://${host}:${port}`)
  })
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  bootstrap().catch(err => {
    console.error('Erreur au démarrage :', err.message)
    process.exit(1)
  })
}

export { app } // pour supertest
