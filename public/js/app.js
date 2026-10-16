import { createApp } from '/vendor/vue.esm-browser.prod.js'
import { router } from './router.js'
import { store } from './store.js'
import { i18n, t } from './i18n.js'
import { settings as settingsApi } from './api.js'
import { migratePainPreferences } from './utils/pain.js'
import AppShell from './components/layout/AppShell.js'
import { startAppUpdates } from './appUpdates.js'

async function init() {
  // Charger les settings depuis le serveur
  try {
    const data = await migratePainPreferences(await settingsApi.get())
    store.setSettings(data)
    // Appliquer la langue
    const lang = data.language || 'fr'
    await i18n.setLocale(lang)
    // Appliquer le thème
    document.documentElement.setAttribute('data-theme', data.theme || 'dark')
  } catch (e) {
    if (e.status === 401) return false // The proxy login redirect is already underway.
    console.warn('[app] Impossible de charger les settings :', e.message)
    await i18n.setLocale('fr')
  }

  // Créer et monter l'app Vue
  const app = createApp(AppShell)
  app.provide('router', router)
  app.provide('store', store)
  app.provide('t', t)

  router.init()
  app.mount('#app')
  return true
}

// Debug — accès console au store (toast, settings)
window.__store = store

init().then(loaded => { if (loaded) startAppUpdates() })
