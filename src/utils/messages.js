import french from '../locales/fr.json' with { type: 'json' }
import english from '../locales/en.json' with { type: 'json' }

const dictionaries = { fr: french, en: english }

// Keep the existing API and saved explanations in French unless a caller opts in.
export function message(key, params = {}, locale = 'fr') {
  const text = dictionaries[locale]?.[key] ?? french[key] ?? key
  return text.replace(/\{\{(\w+)\}\}/g, (placeholder, name) => params[name] ?? placeholder)
}
