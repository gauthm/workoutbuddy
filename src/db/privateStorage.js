import fs from 'node:fs'
import path from 'node:path'

export function privateCreation(action) {
  const previous = process.umask(0o077)
  try {return action()} finally {process.umask(previous)}
}

// Never follow a symbolic link when tightening or opening sensitive storage.
export function privateFile(filename) {
  let stat
  try {stat = fs.lstatSync(filename)} catch (error) {if (error.code === 'ENOENT') return; throw error}
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Stockage privé : fichier ordinaire requis.')
  fs.chmodSync(filename, 0o600)
}

export function privateDirectory(directory, {restrictExisting = true} = {}) {
  const exists = fs.existsSync(directory)
  fs.mkdirSync(directory, {recursive: true, mode: 0o700})
  const stat = fs.lstatSync(directory)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Stockage privé : dossier ordinaire requis.')
  // A custom DB_PATH may live in an existing home or mounted directory.
  // Do not change that parent's permissions; its data files remain owner-only.
  if (!exists || restrictExisting) fs.chmodSync(directory, 0o700)
  else if (stat.mode & 0o022) throw new Error('Stockage privé : choisir un dossier non modifiable par les autres utilisateurs.')
}

export function privateBackups(dbPath, {create = false} = {}) {
  const directory = path.join(path.dirname(dbPath), 'backups')
  if (create || fs.existsSync(directory)) {
    privateDirectory(directory)
    for (const name of fs.readdirSync(directory)) {
      // Also cover older/manual SQLite backups with a different naming convention.
      if (/\.(db|sqlite|sqlite3)(-(wal|shm|journal))?$|\.tmp$/i.test(name)) privateFile(path.join(directory, name))
    }
  }
  return directory
}
