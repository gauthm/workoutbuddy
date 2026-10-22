import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { privateCreation, privateFile, privateBackups } from './privateStorage.js'

// VACUUM INTO also reads transactions in the WAL journal.
export function createBackup(db, dbPath, { force = false } = {}) {
  if (dbPath === ':memory:') return null
  const directory = privateBackups(dbPath, {create: true})
  const today = new Date().toISOString().slice(0, 10)
  const suffix = force ? `_${Date.now()}_${randomUUID().slice(0, 8)}` : ''
  const destination = path.join(directory, `workoutbuddy_${today}${suffix}.db`)
  if (!fs.existsSync(destination)) {
    const temporary = `${destination}.${randomUUID()}.tmp`
    try {
      privateCreation(() => db.prepare('VACUUM INTO ?').run(temporary))
      privateFile(temporary)
      fs.renameSync(temporary, destination)
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
    }
  }
  privateFile(destination)
  const backups = fs.readdirSync(directory)
    .filter(name => /^workoutbuddy_.*\.db$/.test(name))
    .sort().reverse()
  for (const name of backups.slice(7)) fs.unlinkSync(path.join(directory, name))
  return destination
}
