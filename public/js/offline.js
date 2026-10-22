document.getElementById('offline-retry').addEventListener('click', () => window.location.reload())

const language = navigator.language?.startsWith('fr') ? 'fr' : 'en'
fetch('/locales/' + language + '.json')
  .then(response => response.ok ? response.json() : null)
  .then(messages => {
    if (!messages) return
    document.documentElement.lang = language
    document.title = messages['offline.title']
    document.getElementById('offline-message').textContent = messages['offline.message']
    document.getElementById('offline-retry').textContent = messages['offline.retry']
  })
  .catch(() => {})
