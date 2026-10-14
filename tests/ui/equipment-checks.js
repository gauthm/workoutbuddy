async (page) => {
  page.setDefaultTimeout(5000)
  const items=[],writes=[],errors=[],checks=[];let next=1
  const assert=(ok,message)=>{if(!ok)throw new Error(message)}
  const handler=async route=>{
    const request=route.request(),method=request.method(),id=Number(new URL(request.url()).pathname.split('/').at(-1))
    if(method==='GET')return route.fulfill({json:{items}})
    const data=request.postDataJSON();writes.push({method,data})
    if(method==='DELETE'){items.splice(items.findIndex(i=>i.id===id),1);return route.fulfill({status:204,body:''})}
    if(method==='POST'){const item={id:next++,...data};items.push(item);return route.fulfill({status:201,json:item})}
    const index=items.findIndex(i=>i.id===id);items[index]={...items[index],...data};return route.fulfill({json:items[index]})
  }
  const onError=e=>errors.push(e.message);page.on('pageerror',onError)
  const group=category=>page.locator(`.dumbbell-rows[data-category="${category}"]:visible`)
  const add=async(category,values)=>{
    const g=group(category);await g.getByRole('button',{name:/Ajouter une ligne/}).click()
    const row=g.locator('form').last()
    for(let n=0;n<values.length;n++)await row.locator('input').nth(n).fill(String(values[n]))
    await row.getByRole('button',{name:/Enregistrer/}).click();await page.waitForTimeout(80)
    return row
  }
  try{
    await page.route('http://workoutbuddy.test/api/v1/equipment**',handler)
    await page.goto('http://workoutbuddy.test/#/equipment');await page.reload()
    await page.locator('.equipment-editor details').first().waitFor()
    assert(await page.locator('.equipment-editor details').count()===8,'Familles manquantes')
    assert(await page.locator('.equipment-editor details[open]').count()===0,'Vue initiale trop longue')
    for(const summary of await page.locator('.equipment-editor details > summary').all())await summary.click()
    assert(await page.locator('.dumbbell-row').count()===0,'Inventaire prérempli')
    assert(await page.locator('.equipment-editor input:checked').count()===0,'Matériel présélectionné')
    checks.push('Inventaire vide sans lignes ni cases préremplies')
    await add('kettlebell',[1,12]);await add('kettlebell',[2,16])
    await add('resistance_band',[2,5,16]);await add('resistance_band',[1,10,30])
    assert(items.filter(i=>i.category==='kettlebell').length===2,'Lignes kettlebell perdues')
    assert(items.filter(i=>i.category==='resistance_band').length===2,'Fourchettes perdues')
    const invalid=await add('resistance_band',[1,20,5])
    assert(items.length===4,'Fourchette inversée enregistrée')
    await invalid.getByRole('button',{name:/Supprimer/}).click()
    checks.push('Ajout de plusieurs kettlebells et bandes, contrôle des fourchettes')
    await page.getByRole('checkbox',{name:'Chaise romaine',exact:true}).check()
    await page.getByRole('checkbox',{name:'Presse à cuisses',exact:true}).check()
    await page.waitForTimeout(150)
    assert(items.some(i=>i.category==='roman_chair')&&items.some(i=>i.category==='leg_press'),'Cases non enregistrées')
    await page.getByRole('checkbox',{name:'Chaise romaine',exact:true}).uncheck()
    await page.waitForTimeout(150)
    assert(!items.some(i=>i.category==='roman_chair'),'Case décochée encore présente')
    assert(!(await page.locator('.equipment-editor').innerText()).includes('✏️'),'Crayon encore présent')
    assert(!(await page.locator('.equipment-editor').innerText()).includes('🗑'),'Poubelle encore présente')
    checks.push('Liste unique, chaise romaine et retrait sans icônes')
    assert(await page.locator('.equipment-editor details').count()===8,'Familles manquantes')
    assert(await page.getByRole('checkbox',{name:'Ballon de gym / Swiss ball',exact:true}).isVisible(),'Ballon absent')
    assert(await page.getByRole('checkbox',{name:'Rouleau de massage',exact:true}).isVisible(),'Rouleau absent')
    assert(await page.locator('[data-family="accessories"] .inventory-choices--flat').evaluate(el=>!!el.previousElementSibling.querySelector('[data-category="resistance_band"]')),'Accessoires pas après les élastiques')
    for (const name of ['Anneaux personnalisés','Machine spécifique']) {
      await page.getByRole('button',{name:'Ajouter un équipement personnalisé',exact:true}).click()
      const dialog=page.getByRole('dialog')
      assert(await dialog.locator('select').count()===0,'Choix de section encore demandé')
      await dialog.getByLabel('Nom',{exact:true}).fill(name)
      await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click()
      await dialog.waitFor({state:'hidden'})
      assert(await page.locator('.inventory-choices--flat').getByRole('checkbox',{name,exact:true}).isChecked(),'Équipement personnalisé absent')
      assert(items.find(i=>i.name===name).category==='other','Catégorie personnalisée incorrecte')
    }
    checks.push('Équipements standard visibles sous les élastiques et personnalisés sans choix de section')
    await group('resistance_band').locator('form').first().locator('input').nth(2).fill('18')
    await page.getByRole('button',{name:/Enregistrer l.inventaire/}).click();await page.waitForTimeout(150)
    assert(items.find(i=>i.category==='resistance_band').resistance_max_kg===18,'Sauvegarde globale perd la résistance')
    await page.evaluate(()=>location.hash='#/exercises/material')
    
    await page.locator('.equipment-editor details').first().waitFor()
    for(const summary of await page.locator('.equipment-editor details > summary').all())await summary.click()
    await group('kettlebell').locator('form').first().waitFor()
    assert(await group('kettlebell').locator('form').count()===2,'Inventaire différent dans les paramètres')
    const band=group('resistance_band').locator('form').first()
    assert(await band.locator('input').nth(2).inputValue()==='18','Modification absente des paramètres')
    assert(await page.locator('.inventory-choices--flat .inventory-checkbox').filter({hasText:'Anneaux personnalisés'}).count()===1,'Équipement personnalisé perdu dans les paramètres')
    assert(await page.locator('.inventory-choices--flat .inventory-checkbox').filter({hasText:'Machine spécifique'}).count()===1,'Équipement personnalisé perdu dans les paramètres')
    checks.push('Éditeur identique et données conservées entre les deux vues')
    const search=page.getByRole('searchbox',{name:'Rechercher du matériel…'})
    await search.fill('elastique');await page.waitForTimeout(100)
    assert(await page.locator('.inventory-family:visible').count()===1,'Recherche par famille incorrecte')
    await search.fill('presse');await page.waitForTimeout(100)
    assert(await page.getByRole('checkbox',{name:'Presse à cuisses',exact:true}).isVisible(),'Recherche de matériel incorrecte')
    assert((await page.locator('.inventory-checkbox:visible').allTextContents()).every(name=>name.toLowerCase().includes('presse')),'Résultats inutiles dans la recherche')
    await search.fill('aucun-resultat');await page.waitForTimeout(100)
    assert(await page.getByText('Aucun matériel ne correspond à cette recherche.',{exact:true}).isVisible(),'Recherche vide sans explication')
    await search.fill('');await page.waitForTimeout(100)
    await page.locator('[data-family="accessories"] > summary').click()
    await page.getByRole('button',{name:/Enregistrer l.inventaire/}).click();await page.waitForTimeout(100)
    assert(items.find(i=>i.category==='resistance_band').resistance_max_kg===18,'Sauvegarde famille fermée incorrecte')
    checks.push('Recherche sans accents, familles, résultats vides et sauvegarde des familles fermées')
    const layouts=[]
    for(const hash of ['#/equipment','#/exercises/material']){
      await page.evaluate(hash=>location.hash=hash,hash);await page.waitForTimeout(120)
      
      await page.locator('.equipment-editor details').first().waitFor()
      for(const detail of await page.locator('.equipment-editor details').all())if(!await detail.evaluate(el=>el.open))await detail.locator('summary').click()
      for(const width of [320,390,768,1280]){
        await page.setViewportSize({width,height:844})
        for(const theme of ['dark','light']){
          await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
          const layout=await page.evaluate(()=>({hash:location.hash,width:innerWidth,theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth,fields:[...document.querySelectorAll('.equipment-editor input')].filter(e=>e.offsetParent).every(e=>e.getBoundingClientRect().right<=innerWidth)}))
          layouts.push(layout)
        }
      }
    }
    assert(layouts.every(l=>!l.overflow&&l.fields),'Débordement mobile ou champ hors écran')
    assert(errors.length===0,'Erreur JavaScript')
    return {checks,layouts:layouts.length,writes:writes.length,errors}
  }finally{
    await page.unroute('http://workoutbuddy.test/api/v1/equipment**',handler)
    page.removeListener('pageerror',onError)
    await page.setViewportSize({width:390,height:844})
    await page.goto('http://workoutbuddy.test/#/equipment');await page.reload()
  }
}
