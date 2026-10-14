import { readFileSync } from 'node:fs'

// Also applied to old JSON backups so restoring them cannot recreate duplicates.
const mergeSql=readFileSync(new URL('../db/migrations/016_catalogue_exercises.sql',import.meta.url),'utf8')
export function isKnownCatalogueAlias(db,exercise) {
  if (typeof exercise?.name_en !== 'string') return false
  return !!db.prepare(`SELECT id FROM exercise WHERE is_custom=0 AND
    (lower(trim(name_en))=lower(trim(?)) OR (lower(trim(?))='hammer curl' AND id='hammer_curls')) LIMIT 1`)
    .get(exercise.name_en,exercise.name_en)
}
export function mergeCatalogueAliases(db) { db.exec(mergeSql) }
