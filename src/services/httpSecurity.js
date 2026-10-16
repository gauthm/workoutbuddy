import { isIP } from 'node:net'

const CSP = [
  "default-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'",
  // Vue compiles the existing JS templates at runtime; no inline scripts are allowed.
  "script-src 'self' 'unsafe-eval'", "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "connect-src 'self'", "worker-src 'self'", "form-action 'self'",
].join('; ')

export function securityConfig(env = process.env) {
  let origin = null
  if (env.PUBLIC_ORIGIN) {
    const url = new URL(env.PUBLIC_ORIGIN)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) throw new Error('PUBLIC_ORIGIN invalide.')
    origin = url.origin
  }
  if (env.NODE_ENV === 'production' && !origin?.startsWith('https://')) {
    throw new Error('PUBLIC_ORIGIN=https://… est requis en production derrière un proxy HTTPS.')
  }
  if (env.TRUST_PROXY && env.TRUST_PROXY !== 'loopback') throw new Error('TRUST_PROXY accepte uniquement loopback.')
  return {origin, trustProxy: env.TRUST_PROXY === 'loopback' ? 'loopback' : false}
}

export function securityHeaders({origin} = {}) {
  const publicHost = origin ? new URL(origin).host : null
  return (req, res, next) => {
    res.set({
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    })
    if (origin?.startsWith('https://') || req.secure) res.set('Strict-Transport-Security', 'max-age=31536000')
    const host = req.get('host')?.toLowerCase()
    let localHost = false
    if (!publicHost && host) {
      try {
        const url = new URL('http://' + host)
        localHost = !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash &&
          (url.hostname === 'localhost' || isIP(url.hostname.replace(/^\[|\]$/g, '')) !== 0)
      } catch { /* A malformed Host is never allowed. */ }
    }
    // Reject arbitrary DNS names locally too, preventing DNS rebinding against localhost/LAN.
    if (publicHost ? host !== publicHost : !localHost) {
      return res.status(403).json({error: 'HOST_NOT_ALLOWED'})
    }
    next()
  }
}

export function sameOriginApi({origin} = {}) {
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    const expected = origin || `${req.protocol}://${req.get('host')}`
    if (req.get('sec-fetch-site') === 'cross-site' || (req.get('origin') && req.get('origin') !== expected)) {
      return res.status(403).json({error: 'CROSS_ORIGIN_FORBIDDEN'})
    }
    const hasBody = Number(req.get('content-length')) > 0 || req.get('transfer-encoding')
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && hasBody && !req.is('application/json')) {
      return res.status(415).json({error: 'JSON_REQUIRED'})
    }
    next()
  }
}

// Bounded storage, no timers and no trust in forwarded IPs unless explicitly configured.
export function rateLimit({limit, windowMs = 60_000, maxEntries = 4096, now = Date.now} = {}) {
  const entries = new Map()
  return (req, res, next) => {
    const time = now(), key = req.ip || req.socket?.remoteAddress || 'local'
    let entry = entries.get(key)
    if (!entry || entry.until <= time) {
      if (!entry && entries.size >= maxEntries) {
        for (const [ip, value] of entries) if (value.until <= time) entries.delete(ip)
        if (entries.size >= maxEntries) {
          res.set('Retry-After', String(Math.ceil(windowMs / 1000)))
          return res.status(429).json({error: 'RATE_LIMITED'})
        }
      }
      entry = {count: 0, until: time + windowMs}
      entries.set(key, entry)
    }
    if (++entry.count > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.until - time) / 1000))))
      return res.status(429).json({error: 'RATE_LIMITED'})
    }
    next()
  }
}

export function expensiveRequests() {
  const ai = rateLimit({limit: 12}), data = rateLimit({limit: 30}), programs = rateLimit({limit: 60})
  let aiInFlight = 0, importsInFlight = 0
  return (req, res, next) => {
    const path = req.path.toLowerCase().replace(/\/+$/, '')
    const isAi = ['/ai/chat', '/ai/generate-equipment-advice', '/settings/test-ai', '/settings/ai-models'].includes(path)
    const isImport = req.method === 'POST' && path === '/import'
    const limiter = isAi ? ai : req.method === 'POST' && ['/import', '/backup', '/reset-all', '/reset-stats'].includes(path) ? data
      : req.method === 'POST' && ['/programs/generate', '/programs/preview'].includes(path) ? programs : null
    const proceed = () => {
      if (!isAi && !isImport) return next()
      if (isAi ? aiInFlight >= 2 : importsInFlight >= 1) {
        res.set('Retry-After', '5')
        return res.status(429).json({error: isAi ? 'AI_BUSY' : 'IMPORT_BUSY'})
      }
      if (isAi) aiInFlight++
      else importsInFlight++
      let released = false
      const release = () => {
        if (released) return
        released = true
        if (isAi) aiInFlight--
        else importsInFlight--
      }
      res.once('finish', release); res.once('close', release)
      next()
    }
    if (limiter) limiter(req, res, proceed)
    else next()
  }
}
