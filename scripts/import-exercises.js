// Usage: node scripts/import-exercises.js <path-to-free-exercise-db-dist-exercises.json>
// Exemple: node scripts/import-exercises.js /tmp/free-exercise-db/dist/exercises.json

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Mappings ────────────────────────────────────────────────

const EQUIPMENT_MAP = {
  'barbell':       ['barbell'],
  'dumbbell':      ['dumbbell_fixed'],
  'cable':         ['cable_machine'],
  'machine':       ['cable_machine'],
  'body only':     [],
  'bands':         ['resistance_band'],
  'kettlebells':   ['kettlebell'],
  'e-z curl bar':  ['ez_bar'],
  'foam roll':     [],
  'other':         [],
  'medicine ball': [],
}

const MUSCLE_MAP = {
  'chest':        'chest',
  'biceps':       'biceps',
  'triceps':      'triceps',
  'shoulders':    'shoulders',
  'middle back':  'back',
  'lats':         'back',
  'lower back':   'lower_back',
  'upper back':   'back',
  'traps':        'traps',
  'quadriceps':   'quads',
  'hamstrings':   'hamstrings',
  'glutes':       'glutes',
  'calves':       'calves',
  'forearms':     'forearms',
  'abdominals':   'core',
  'neck':         'neck',
  'abductors':    'glutes',
  'adductors':    'inner_thigh',
}

function mapMuscles(arr) {
  if (!arr) return []
  return [...new Set(arr.map(m => MUSCLE_MAP[m.toLowerCase()] ?? m).filter(Boolean))]
}

function mapEquipment(eq) {
  if (!eq) return []
  return EQUIPMENT_MAP[eq.toLowerCase()] ?? []
}

function toSnakeCase(str) {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/^_/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function inferMovementPattern(ex) {
  const name    = (ex.name || '').toLowerCase()
  const primary = ex.primaryMuscles || []
  const force   = ex.force
  const cat     = ex.category

  if (cat === 'cardio' || cat === 'stretching') return 'other'
  if (name.includes('deadlift'))                return 'hinge'
  if (name.includes('lunge'))                   return 'lunge'
  if (name.includes('squat') || name.includes('leg press')) return 'squat'
  if (name.includes('carry') || name.includes('farmer'))    return 'carry'

  if (primary.includes('quadriceps') && force === 'push')      return 'squat'
  if (primary.includes('hamstrings') && ex.mechanic === 'compound') return 'hinge'

  if (primary.includes('chest'))                               return 'push_horizontal'
  if (primary.includes('shoulders') && force === 'push')       return 'push_vertical'
  if (primary.includes('triceps') && name.includes('press'))   return 'push_horizontal'

  if (primary.some(m => ['lats','middle back','upper back'].includes(m))) {
    return name.includes('row') ? 'pull_horizontal' : 'pull_vertical'
  }
  if (primary.includes('biceps'))   return 'pull_vertical'
  if (primary.includes('abdominals') || primary.includes('lower back')) return 'core'

  return 'other'
}

function inferUnilateral(ex) {
  const name = (ex.name || '').toLowerCase()
  return (
    name.includes('alternate') ||
    name.includes('single') ||
    name.includes('one-arm') ||
    name.includes('one arm') ||
    name.includes('unilateral')
  ) ? 1 : 0
}

function transform(ex) {
  const id = toSnakeCase(ex.id || ex.name)
  return {
    id,
    name_fr:            ex.name,   // traduction FR = EN par défaut
    name_en:            ex.name,
    category:           ex.category || 'strength',
    force:              ex.force || null,
    mechanic:           ex.mechanic || null,
    movement_pattern:   inferMovementPattern(ex),
    primary_muscles:    mapMuscles(ex.primaryMuscles),
    secondary_muscles:  mapMuscles(ex.secondaryMuscles),
    equipment_required: mapEquipment(ex.equipment),
    instructions_fr:    ex.instructions || [],
    instructions_en:    ex.instructions || [],
    image_paths:        (ex.images || []).map(img => {
      const parts = img.split('/')
      return `${toSnakeCase(parts[0])}/${parts[1]}`
    }),
    is_custom:    0,
    is_unilateral: inferUnilateral(ex),
  }
}

// ── Script principal ────────────────────────────────────────

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: node scripts/import-exercises.js <path-to-exercises.json>')
  process.exit(1)
}

if (!fs.existsSync(inputPath)) {
  console.error(`Fichier introuvable : ${inputPath}`)
  process.exit(1)
}

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
console.log(`Exercices source : ${raw.length}`)

// Déduplication par ID
const seen = new Set()
const transformed = []
for (const ex of raw) {
  const t = transform(ex)
  if (seen.has(t.id)) {
    t.id = t.id + '_2'  // suffixe si collision
  }
  seen.add(t.id)
  transformed.push(t)
}

// Écriture du JSON
const outPath = path.join(__dirname, '..', 'src', 'seed', 'exercises.json')
fs.writeFileSync(outPath, JSON.stringify(transformed, null, 2), 'utf8')
console.log(`Écrit : ${outPath} (${transformed.length} exercices)`)

// Copie des images
const srcImagesDir = path.join(path.dirname(inputPath), '..', 'exercises')
const destImagesDir = path.join(__dirname, '..', 'public', 'exercises', 'images')

if (fs.existsSync(srcImagesDir)) {
  fs.mkdirSync(destImagesDir, { recursive: true })
  let copied = 0
  for (const ex of raw) {
    const srcFolder  = path.join(srcImagesDir, ex.id)
    const destFolder = path.join(destImagesDir, toSnakeCase(ex.id))
    if (!fs.existsSync(srcFolder)) continue
    fs.mkdirSync(destFolder, { recursive: true })
    for (const file of fs.readdirSync(srcFolder)) {
      fs.copyFileSync(path.join(srcFolder, file), path.join(destFolder, file))
      copied++
    }
  }
  console.log(`Images copiées : ${copied} fichiers`)
} else {
  console.warn('Dossier images source introuvable — images non copiées.')
}

console.log('Import terminé.')
