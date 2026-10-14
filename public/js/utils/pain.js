import { settings as settingsApi } from '../api.js'
import { ALL_MUSCLES } from './muscles.js'
export async function migratePainPreferences(settings) {
  const key='wb_painful_muscles', raw=localStorage.getItem(key)
  if (raw===null) return settings
  try {
    const parsed=JSON.parse(raw)
    const legacy=Array.isArray(parsed) ? [...new Set(parsed.filter(m=>ALL_MUSCLES.includes(m)))] : []
    if (!settings.painful_muscles?.length && legacy.length) settings=await settingsApi.update({painful_muscles:legacy})
    localStorage.removeItem(key)
  } catch (err) {console.warn('[pain preferences]',err.message)}
  return settings
}
