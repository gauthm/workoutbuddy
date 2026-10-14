import { ALL_MUSCLES } from '../../public/js/utils/muscles.js'
export function getPainfulMuscles(db) {
  const row=db.prepare("SELECT value FROM settings WHERE key='painful_muscles'").get()
  const value=row ? JSON.parse(row.value) : []
  return Array.isArray(value) ? value.filter(m=>ALL_MUSCLES.includes(m)) : []
}
export function isExerciseRestricted(exercise, muscles) {
  const parse=value=>Array.isArray(value) ? value : JSON.parse(value || '[]')
  return [...parse(exercise.primary_muscles),...parse(exercise.secondary_muscles)].some(m=>muscles.includes(m))
}
