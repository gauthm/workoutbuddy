import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const DB_PATH = path.join(DATA_DIR, 'workoutbuddy.db')

let instance = null

export function getDb() {
  if (instance) return instance

  fs.mkdirSync(DATA_DIR, { recursive: true })
  instance = new Database(DB_PATH)
  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')
  instance.pragma('busy_timeout = 5000')
  return instance
}
