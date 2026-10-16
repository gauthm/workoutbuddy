import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import { privateCreation, privateDirectory, privateFile, privateBackups } from './privateStorage.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.join(__dirname, '..', '..')

// Charge le fichier .env à la racine s'il existe (Node 24 LTS, aucune dépendance)
try { process.loadEnvFile(path.join(ROOT_DIR, '.env')) } catch (_) { /* absent : ignoré */ }

// DB_PATH surchargeable via l'environnement (défaut : ./data/workoutbuddy.db)
const DB_PATH = process.env.DB_PATH
  ? (process.env.DB_PATH === ':memory:' ? ':memory:' : path.resolve(process.cwd(), process.env.DB_PATH))
  : path.join(ROOT_DIR, 'data', 'workoutbuddy.db')

let instance = null

export function getDbPath() {
  return DB_PATH
}

export function getDb() {
  if (instance) return instance

  instance = privateCreation(() => {
    const files = DB_PATH === ':memory:' ? [] : [DB_PATH, DB_PATH+'-wal', DB_PATH+'-shm', DB_PATH+'-journal']
    if (files.length) {
      privateDirectory(path.dirname(DB_PATH), {restrictExisting: path.dirname(DB_PATH) === path.join(ROOT_DIR, 'data')})
      files.forEach(privateFile)
      privateBackups(DB_PATH)
    }
    const db = new Database(DB_PATH)
    try {
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = ON')
      db.pragma('busy_timeout = 5000')
      files.forEach(privateFile)
      return db
    } catch (error) {db.close(); throw error}
  })
  return instance
}
