// Run in a one-off container ONLY after stopping the application.
import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import Database from 'better-sqlite3'

process.umask(0o077)
const target = process.env.DB_PATH || '/app/data/workoutbuddy.db'
const root = path.dirname(target)
fs.mkdirSync(root, { recursive: true, mode: 0o700 })
const staging = fs.mkdtempSync(path.join(root, '.restore-'))
const incoming = path.join(staging, 'incoming.db')
const moved = []
try {
  await pipeline(process.stdin, fs.createWriteStream(incoming, { mode: 0o600 }))
  const candidate = new Database(incoming, { readonly: true, fileMustExist: true })
  try {
    if (candidate.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Invalid SQLite backup')
    // Reject arbitrary SQLite files before replacing a WorkoutBuddy database.
    candidate.prepare('SELECT key, value FROM settings LIMIT 1').all()
    candidate.prepare('SELECT id FROM exercise LIMIT 1').all()
  } finally { candidate.close() }
  // Preserve the previous DB and journals together, so replacement can be rolled back.
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const source = target + suffix
    if (!fs.existsSync(source)) continue
    const destination = path.join(staging, 'previous.db' + suffix)
    fs.renameSync(source, destination)
    moved.push([source, destination])
  }
  fs.renameSync(incoming, target)
  console.log(`Restored database; previous files retained in ${staging}`)
} catch (error) {
  for (const [source, destination] of moved.reverse()) fs.renameSync(destination, source)
  fs.rmSync(incoming, { force: true })
  fs.rmdirSync(staging)
  throw error
}
