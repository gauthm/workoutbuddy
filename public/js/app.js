import { createApp, watch } from '/vendor/vue.esm-browser.prod.js'
import { router } from './router.js'
import { store } from './store.js'
import { i18n, t } from './i18n.js'
import { settings as settingsApi } from './api.js'
import { migratePainPreferences } from './utils/pain.js'
import AppShell from './components/layout/AppShell.js'
import { startAppUpdates } from './appUpdates.js'
import { createScreenWakeLock } from './utils/screenWakeLock.js'
import { trackMobileKeyboard } from './utils/mobileKeyboard.js'

async function init() {
  // Load settings from the server
  try {
    const data = await migratePainPreferences(await settingsApi.get())
    store.setSettings(data)
    // Apply the language
    const lang = data.language || 'fr'
    await i18n.setLocale(lang)
    // Apply the theme
    document.documentElement.setAttribute('data-theme', data.theme || 'dark')
  } catch (e) {
    if (e.status === 401) return false // The proxy login redirect is already underway.
    console.warn('[app] Unable to load settings:', e.message)
    await i18n.setLocale('fr')
  }

  // Create and mount the Vue app
  const screenWakeLock = createScreenWakeLock({ navigator, document,
    onChange: state => { store.screenWakeLock = state },
  })
  watch(() => store.settings?.keep_screen_awake,
    enabled => { screenWakeLock.setEnabled(enabled) }, { immediate: true })
  const app = createApp(AppShell)
  app.provide('router', router)
  app.provide('store', store)
  app.provide('t', t)

  router.init()
  trackMobileKeyboard()
  app.mount('#app')
  return true
}

// Debug: console access to the store (toast, settings)
window.__store = store

init().then(loaded => { if (loaded) startAppUpdates() })
