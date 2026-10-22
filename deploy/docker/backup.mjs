import { getDb, getDbPath } from '../../src/db/database.js'
import { createBackup } from '../../src/db/backup.js'

const db = getDb()
try {
  console.log(createBackup(db, getDbPath(), { force: true }))
} finally {
  db.close()
}
