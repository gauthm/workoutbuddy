import Database from 'better-sqlite3'

// Stub T1.1 — remplacé par le singleton réel en T1.2.
// Retourne une DB en mémoire avec la table settings pour que
// server.js démarre sans planter avant l'implémentation des migrations.
let db = null

export function getDb() {
  if (!db) {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)').run()
  }
  return db
}
