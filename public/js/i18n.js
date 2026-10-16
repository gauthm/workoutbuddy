import { reactive } from '/vendor/vue.esm-browser.prod.js'

const locales = {}

async function loadLocale(lang) {
  if (locales[lang]) return
  try {
    const res = await fetch(`/locales/${lang}.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    locales[lang] = await res.json()
  } catch (e) {
    console.warn(`[i18n] Impossible de charger la locale "${lang}"`)
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

// t('key') ou t('key', { name: 'John' }) → interpolation {{name}}
export function t(key, params = {}) {
  const dict = locales[i18n.locale] || locales['fr'] || {}
  let str = dict[key]
  if (str === undefined) {
    // Fallback sur fr si locale courante ne contient pas la clé
    str = locales['fr']?.[key] ?? key
  }
  // Interpolation : remplacer {{param}} par la valeur
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? `{{${k}}}`)
}

// tm('chest') → t('muscles.chest'), fallback sur le nom brut si introuvable
export function tm(muscle) {
  const key = 'muscles.' + muscle
  const dict = locales[i18n.locale] || locales['fr'] || {}
  let str = dict[key]
  if (str === undefined) str = locales['fr']?.[key]
  if (str === undefined) return muscle
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => '')
}

// Catalogue, séances et statistiques emploient deux jeux de noms de colonnes.
// Lire la locale ici rend aussi les listes et titres réactifs au changement de langue.
export function exerciseName(exercise) {
  if (!exercise) return ''
  const fr = exercise.name_fr || exercise.exercise_name_fr
  const en = exercise.name_en || exercise.exercise_name_en
  return (i18n.locale === 'en' ? en || fr : fr || en) || ''
}

export function exerciseInstructions(exercise) {
  if (!exercise) return []
  const preferred = exercise['instructions_' + i18n.locale]
  const instructions = Array.isArray(preferred) && preferred.length
    ? preferred
    : exercise.instructions_en?.length ? exercise.instructions_en : exercise.instructions_fr || []
  // All suggested and logged dumbbell loads use the weight of a single dumbbell.
  const dumbbell = exercise.equipment_required?.some(category => category.startsWith('dumbbell'))
  return dumbbell ? [...instructions, t('exercises.dumbbell_weight_entry')] : instructions
}

// Initialisation : charger fr dès le démarrage
loadLocale('fr')
