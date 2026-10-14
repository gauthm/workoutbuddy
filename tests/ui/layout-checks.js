async (page) => {
  page.setDefaultTimeout(3000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const results = []
  const routes = ['#/','#/session','#/session/3','#/session/history','#/exercises','#/exercises/new','#/exercises/ab_roller','#/exercises/ab_roller/edit','#/programs','#/programs/1','#/programs/new','#/programs/generate','#/stats','#/stats/exercise/ab_roller','#/stats/bodyweight','#/calendar','#/equipment','#/settings','#/coach']
  for (const language of ['fr','en']) {
    await page.evaluate(async language => {
      const { i18n } = await import('/js/i18n.js')
      await i18n.setLocale(language)
      window.__store.settings.language = language
    }, language)
    for (const width of [320,390,768,1280]) {
      await page.setViewportSize({width,height:844})
      for (const theme of ['dark','light']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
        for (const hash of routes) {
          await page.evaluate(hash => location.hash = hash, hash)
          await page.waitForTimeout(90)
          results.push(await page.evaluate(() => ({
            hash: location.hash, width: innerWidth,
            theme: document.documentElement.dataset.theme,
            language: document.documentElement.lang,
            overflow: document.documentElement.scrollWidth > innerWidth,
            activeTabs: document.querySelectorAll('[aria-current="page"]').length,
            missingKeys: (document.querySelector('.view')?.innerText || '').match(/\b(?:settings|equipment|programs|stats|calendar|exercises|session|coach)\.[a-z_]+\b/g),
            smallHeader: document.querySelector('.page-header').getBoundingClientRect().height < 52,
          })))
        }
      }
    }
  }
  await page.evaluate(async () => {
    const { i18n } = await import('/js/i18n.js')
    await i18n.setLocale('fr')
    window.__store.settings.language = 'fr'
    document.documentElement.dataset.theme = 'dark'
  })
  return { cases: results.length, failures: results.filter(r => r.overflow || r.missingKeys || r.activeTabs !== 1 || r.smallHeader), errors }
}
