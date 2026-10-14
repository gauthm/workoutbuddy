import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.join(__dirname, '..', '..')

// Charge le fichier .env à la racine s'il existe (Node >= 20.6, aucune dépendance)
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

  if (DB_PATH !== ':memory:') fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  instance = new Database(DB_PATH)
  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')
  instance.pragma('busy_timeout = 5000')
  return instance
}
