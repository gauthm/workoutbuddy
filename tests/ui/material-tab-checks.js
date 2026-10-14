async page => {
  page.setDefaultTimeout(4000)
  const errors=[],layouts=[]
  const assert=(ok,message)=>{if(!ok)throw Error(message)}
  const onError=e=>errors.push(e.message);page.on('pageerror',onError)
  try {
    await page.goto('http://workoutbuddy.test/#/exercises')
    await page.locator('.exercise-tabs').waitFor()
    const tabs=page.locator('.exercise-tabs')
    assert((await tabs.getByRole('button').allTextContents()).map(s=>s.trim()).join('|')==='Exercices|Douleurs|Matériel','Ordre des onglets incorrect')
    await tabs.getByRole('button',{name:'Matériel',exact:true}).click()
    await page.locator('.equipment-editor').waitFor()
    assert(page.url().endsWith('#/exercises/material'),'Lien direct incorrect')
    assert(await page.getByRole('heading',{name:'Exercices et Matériel',exact:true}).isVisible(),'Titre incorrect')
    await page.locator('[data-family="free_weights"] > summary').click()
    const kb=page.locator('[data-category="kettlebell"]')
    await kb.getByRole('button',{name:/Ajouter une ligne/}).click()
    await kb.locator('form input').nth(1).fill('24')
    await tabs.getByRole('button',{name:'Douleurs',exact:true}).click()
    await page.locator('.pain-grid').waitFor()
    await tabs.getByRole('button',{name:'Matériel',exact:true}).click()
    await kb.waitFor()
    assert(await kb.locator('form input').nth(1).inputValue()==='24','Brouillon perdu entre les onglets')
    const nav=page.locator('.bottom-nav').getByRole('button',{name:'Exercices et Matériel',exact:true})
    assert(await nav.getAttribute('aria-current')==='page','Navigation inactive sur le matériel')
    for(const width of [320,390,768,1280]) {
      await page.setViewportSize({width,height:844})
      const layout=await nav.locator('.bottom-nav__label').evaluate(e=>({overflow:document.documentElement.scrollWidth>innerWidth,lines:e.children.length,secondBelow:e.children[1].getBoundingClientRect().top>=e.children[0].getBoundingClientRect().bottom-.5,labelFits:e.getBoundingClientRect().width<=e.parentElement.getBoundingClientRect().width}))
      assert(!layout.overflow&&layout.lines===2&&layout.secondBelow&&layout.labelFits,'Libellé sur deux lignes incorrect');layouts.push(width)
    }
    await page.goto('http://workoutbuddy.test/#/settings')
    await page.getByRole('heading',{name:'Paramètres',exact:true}).waitFor()
    assert(await page.getByRole('button',{name:'Matériel',exact:true}).count()===0,'Matériel encore dans les paramètres')
    await page.goto('http://workoutbuddy.test/#/equipment')
    await page.locator('.equipment-editor').waitFor()
    assert(await tabs.getByRole('button',{name:'Matériel',exact:true}).getAttribute('class').then(s=>s.includes('--active')),'Ancien lien ne mène pas au nouvel onglet')
    assert(errors.length===0,'Erreurs JavaScript')
    return {tabs:3,draftPreserved:true,oldLinkSupported:true,layouts,errors}
  } finally {page.removeListener('pageerror',onError)}
}
