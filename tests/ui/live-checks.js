async (page) => {
  page.setDefaultTimeout(4000)
  const errors = [], badResponses = [], interactions = [], layouts = []
  const onError = e => errors.push(e.message)
  const onResponse = response => {
    if (response.url().startsWith('http://localhost:3000/') && response.status() >= 400) badResponses.push({url:new URL(response.url()).pathname,status:response.status()})
  }
  page.on('pageerror', onError)
  page.on('response', onResponse)
  const assert = (value,message) => { if (!value) throw new Error(message) }
  const check = async (name, fn) => {
    try { await fn(); interactions.push({name,passed:true}) }
    catch(e) { interactions.push({name,passed:false,error:e.message}) }
  }
  const go = async hash => {
    await page.evaluate(hash => location.hash = hash,hash)
    await page.waitForTimeout(120)
    await page.locator('.loading-spinner').waitFor({state:'hidden'})
  }
  const initial = await page.evaluate(async () => {
    const exercises = await (await fetch('/api/v1/exercises')).json()
    return {
      exerciseId: exercises.exercises[0].id,
      customId: exercises.exercises.find(x=>x.is_custom)?.id,
      count: exercises.exercises.length,
      language: document.documentElement.lang,
      theme: document.documentElement.dataset.theme,
      pain: localStorage.getItem('wb_painful_muscles'),
    }
  })
  try {
    await page.setViewportSize({width:390,height:844})
    await check('Live home: shortcuts and creation through the coach', async()=>{
      await go('#/')
      for(const name of ['Programmes','Calendrier','Historique']) assert(await page.getByRole('button',{name,exact:true}).count()===1,'Shortcut missing: '+name)
      await page.getByRole('button',{name:'Créer un programme avec le coach IA',exact:true}).click()
      await page.locator('.coach-view').waitFor()
    })
    await check('Live exercises: search and API filters',async()=>{
      await go('#/exercises')
      await page.getByRole('searchbox').fill('Ab Roller')
      await page.waitForTimeout(350)
      await page.locator('.loading-spinner').waitFor({state:'hidden'})
      assert(await page.locator('.exercise-list .exercise-card').count()>0,'Search without results')
      assert((await page.locator('.exercise-list').innerText()).includes('Ab Roller'),'Inconsistent result')
      await page.getByRole('combobox',{name:'Muscle',exact:true}).selectOption('core')
      await page.waitForTimeout(250)
      await page.locator('.loading-spinner').waitFor({state:'hidden'})
      await page.getByRole('button',{name:'Effacer les filtres',exact:true}).click()
      await page.locator('.loading-spinner').waitFor({state:'hidden'})
      assert(await page.getByRole('searchbox').inputValue()==='','Search not cleared')
    })
    await check('Live exercise: details and images',async()=>{
      await go('#/exercises/'+initial.exerciseId)
      await page.locator('.exercise-detail__img').waitFor()
      assert(await page.locator('.exercise-detail__img').evaluate(img=>img.complete&&img.naturalWidth>0),'Image introuvable')
      assert(await page.locator('.instruction-list li').count()>0,'Instructions absentes')
      if(await page.locator('.exercise-detail__dot').count()>1){
        await page.locator('.exercise-detail__dot').nth(1).click()
        assert(await page.locator('.exercise-detail__dot').nth(1).getAttribute('aria-pressed')==='true','Image not selected')
      }
    })
    await check('Exercise form: validation without writes',async()=>{
      await go('#/exercises/new')
      const input=page.getByLabel('Nom (français) *',{exact:true})
      assert(await input.evaluate(e=>!e.checkValidity()),'Required name not validated')
      await input.fill('Check without saving')
      await page.locator('.muscle-chips').first().getByRole('button',{name:'Abdominaux',exact:true}).click()
      assert(await page.locator('.muscle-chips').first().locator('.chip--active').count()===1,'Muscle not selected')
    })
    await check('Live calendar: navigation and keyboard selection',async()=>{
      await go('#/calendar')
      const before=await page.locator('.calendar-nav__label').innerText()
      await page.locator('.calendar-nav__btn').last().click()
      await page.locator('.loading-spinner').waitFor({state:'hidden'})
      assert(await page.locator('.calendar-nav__label').innerText()!==before,'Month unchanged')
      const cell=page.locator('.calendar-cell').nth(12)
      const date=await cell.getAttribute('aria-label')
      await cell.focus();await page.keyboard.press('Enter')
      assert(await page.locator('.calendar-day-panel__date').innerText()===date,'Inconsistent day')
    })
    await check('Live equipment: opening, keyboard, and closing',async()=>{
      await go('#/equipment')
      await page.locator('.page-header__actions button').click()
      await page.getByRole('dialog').waitFor()
      await page.keyboard.press('Shift+Tab')
      assert(await page.evaluate(()=>document.querySelector('[role="dialog"]').contains(document.activeElement)),'Focus outside dialog')
      await page.keyboard.press('Escape')
      assert(await page.getByRole('dialog').count()===0,'Dialog not closed')
    })
    await check('Live settings: accordions and forms',async()=>{
      await go('#/settings')
      const sections=page.locator('.settings-section__toggle')
      for(let i=1;i<await sections.count();i++)await sections.nth(i).click()
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Settings overflow')
      await page.getByRole('button',{name:'Réinitialiser mon profil',exact:true}).click()
      await page.getByRole('dialog').waitFor()
      assert(await page.getByRole('button',{name:'Effacer mon profil',exact:true}).isDisabled(),'Confirmation obligatoire absente')
      await page.keyboard.press('Escape')
    })
    await check('Live coach: history and input without sending',async()=>{
      await go('#/coach')
      await page.getByRole('button',{name:'Historique des conversations',exact:true}).click()
      await page.getByRole('dialog').waitFor()
      await page.keyboard.press('Escape')
      await page.locator('.coach-view__input').fill('Check\nwith multiple lines\nwithout sending')
      await page.locator('.coach-view__input').dispatchEvent('input')
      assert(await page.evaluate(()=>document.querySelector('.coach-view__input-area').getBoundingClientRect().bottom<=document.querySelector('.bottom-nav').getBoundingClientRect().top+1),'Input area obscured')
    })
    const routes=['#/','#/session','#/session/history','#/exercises','#/exercises/new','#/exercises/'+initial.exerciseId,'#/programs','#/programs/new','#/programs/generate','#/stats','#/stats/exercise/'+initial.exerciseId,'#/stats/bodyweight','#/calendar','#/equipment','#/settings','#/coach']
    if(initial.customId)routes.push('#/exercises/'+initial.customId+'/edit')
    for(const language of ['fr','en']) {
      await page.evaluate(async language=>{const {i18n}=await import('/js/i18n.js');await i18n.setLocale(language);window.__store.settings.language=language},language)
      for(const width of [320,390,768,1280]){
        await page.setViewportSize({width,height:844})
        for(const theme of ['dark','light']){
          await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
          for(const hash of routes){
            await go(hash)
            layouts.push(await page.evaluate(()=>({hash:location.hash,width:innerWidth,theme:document.documentElement.dataset.theme,language:document.documentElement.lang,overflow:document.documentElement.scrollWidth>innerWidth,activeTabs:document.querySelectorAll('[aria-current="page"]').length,missingKeys:(document.querySelector('.view')?.innerText||'').match(/\b(?:settings|equipment|programs|stats|calendar|exercises|session|coach)\.[a-z_]+\b/g)})))
          }
        }
      }
    }
    return {origin:'http://localhost:3000',exerciseCount:initial.count,interactions,layout:{cases:layouts.length,failures:layouts.filter(x=>x.overflow||x.activeTabs!==1||x.missingKeys)},errors,badResponses:[...new Map(badResponses.map(x=>[x.url,x])).values()]}
  } finally {
    await page.evaluate(async initial=>{
      const {i18n}=await import('/js/i18n.js');await i18n.setLocale(initial.language);window.__store.settings.language=initial.language;document.documentElement.dataset.theme=initial.theme
      if(initial.pain===null)localStorage.removeItem('wb_painful_muscles');else localStorage.setItem('wb_painful_muscles',initial.pain)
      location.hash='#/'
    },initial)
    await page.setViewportSize({width:390,height:844})
    page.removeListener('pageerror',onError)
    page.removeListener('response',onResponse)
  }
}
