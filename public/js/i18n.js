import { reactive } from '/vendor/vue.esm-browser.prod.js'

let currentLocale = 'fr'
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
    currentLocale = lang
    document.documentElement.lang = lang
  }
})

// t('key') ou t('key', { name: 'John' }) → interpolation {{name}}
export function t(key, params = {}) {
  const dict = locales[currentLocale] || locales['fr'] || {}
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
  const dict = locales[currentLocale] || locales['fr'] || {}
  let str = dict[key]
  if (str === undefined) str = locales['fr']?.[key]
  if (str === undefined) return muscle
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => '')
}

// Initialisation : charger fr dès le démarrage
loadLocale('fr')
