import { reactive } from '/vendor/vue.esm-browser.prod.js'

const locales = {}

async function loadLocale(lang) {
  if (locales[lang]) return
  try {
    const res = await fetch(`/locales/${lang}.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    locales[lang] = await res.json()
  } catch (e) {
    console.warn(`[i18n] Unable to load locale "${lang}"`)
    locales[lang] = {}
  }
}

export const i18n = reactive({
  locale: 'fr',
  async setLocale(lang) {
    await loadLocale(lang)
    this.locale = lang
    document.documentElement.lang = lang
  }
})

// t('key') or t('key', { name: 'John' }) → interpolation {{name}}
export function t(key, params = {}) {
  const dict = locales[i18n.locale] || locales['fr'] || {}
  let str = dict[key]
  if (str === undefined) {
    // Fall back to French if the current locale does not contain the key
    str = locales['fr']?.[key] ?? key
  }
  // Interpolation: replace {{param}} with its value
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? `{{${k}}}`)
}

// tm('chest') → t('muscles.chest'), fall back to the raw name if not found
export function tm(muscle) {
  const key = 'muscles.' + muscle
  const dict = locales[i18n.locale] || locales['fr'] || {}
  let str = dict[key]
  if (str === undefined) str = locales['fr']?.[key]
  if (str === undefined) return muscle
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => '')
}

// Catalog, sessions, and statistics use two sets of column names.
// Reading the locale here also makes lists and titles react to language changes.
export function exerciseName(exercise) {
  if (!exercise) return ''
  const fr = exercise.name_fr || exercise.exercise_name_fr
  const en = exercise.name_en || exercise.exercise_name_en
  return (i18n.locale === 'en' ? en || fr : fr || en) || ''
}

export function exerciseInstructions(exercise, includeWeightNote = true) {
  if (!exercise) return []
  const preferred = exercise['instructions_' + i18n.locale]
  const instructions = Array.isArray(preferred) && preferred.length
    ? preferred
    : exercise.instructions_en?.length ? exercise.instructions_en : exercise.instructions_fr || []
  // All suggested and logged dumbbell loads use the weight of a single dumbbell.
  const dumbbell = exercise.equipment_required?.some(category => category.startsWith('dumbbell'))
  return dumbbell && includeWeightNote ? [...instructions, t('exercises.dumbbell_weight_entry')] : instructions
}

// Initialization : load French at startup
loadLocale('fr')
