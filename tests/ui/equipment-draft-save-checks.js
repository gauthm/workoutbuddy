async page => {
 page.setDefaultTimeout(4000)
 const errors=[],writes=[],layouts=[];let failNext=false,nextId=10
 let items=[{id:1,category:'dumbbell_fixed',name:'Fixed',count:2,weight_kg:8,notes:'preserve'},
 {id:2,category:'kettlebell',name:'KB',count:1,weight_kg:16},
 {id:3,category:'resistance_band',name:'Band',count:1,resistance_min_kg:5,resistance_max_kg:16},
 {id:4,category:'bench',name:'Bench',count:1}]
 const clone=value=>JSON.parse(JSON.stringify(value)),baseline=clone(items)
 const assert=(ok,message)=>{if(!ok)throw Error(message)}
 const onError=e=>errors.push(e.message);page.on('pageerror',onError)
 const handler=route=>{
  const req=route.request()
  if(req.method()==='GET')return route.fulfill({json:{items}})
  writes.push({method:req.method(),path:new URL(req.url()).pathname,body:req.postDataJSON()})
  assert(req.method()==='PUT'&&new URL(req.url()).pathname.endsWith('/inventory'),'Sauvegarde individuelle restante')
  if(failNext){failNext=false;return route.fulfill({status:500,json:{error:'INTERNAL_ERROR'}})}
  items=req.postDataJSON().items.map(item=>({...item,id:item.id||nextId++}))
  return route.fulfill({json:{items}})
 }
 await page.route('http://workoutbuddy.test/api/v1/equipment**',handler)
 try {
  await page.goto('http://workoutbuddy.test/?inventory-draft=1#/exercises/material')
  await page.reload()
  await page.locator('.inventory-family').first().waitFor()
  const dock=page.locator('.equipment-editor .settings-save-dock')
  assert(await dock.count()===0,'Brouillon au chargement')
  assert(await page.locator('.equipment-settings__save').count()===0,'Gros bouton présent')
  const open=async id=>{const family=page.locator(`[data-family="${id}"]`);if(!await family.evaluate(e=>e.open))await family.locator('summary').evaluate(e=>e.click())}
  await open('free_weights')
  const fixed=page.locator('[data-category="dumbbell_fixed"]'),first=fixed.locator('.dumbbell-row').first()
  assert(await first.getByRole('button').count()===1,'La coche de validation est encore présente')
  assert((await first.getByRole('button').textContent()).trim()==='×','La croix doit rester')
  await first.locator('input').nth(1).fill('10');await dock.waitFor()
  await first.locator('input').nth(1).fill('8');await dock.waitFor({state:'hidden'})
  await first.locator('input').nth(1).fill('10')
  await page.getByRole('searchbox',{name:'Rechercher du matériel…'}).fill('presse')
  await page.getByRole('checkbox',{name:'Presse à cuisses',exact:true}).check()
  assert(writes.length===0,'Case cochée sauvegardée automatiquement')
  await page.getByRole('searchbox',{name:'Rechercher du matériel…'}).fill('')
  await open('free_weights')
  await first.getByRole('button').click()
  assert(await fixed.locator('.dumbbell-row').count()===0,'Suppression en brouillon absente')
  await dock.getByRole('button',{name:'Annuler',exact:true}).click();await dock.waitFor({state:'hidden'})
  assert(await first.locator('input').nth(1).inputValue()==='8','Annuler ne restaure pas le poids')
  assert(JSON.stringify(items)===JSON.stringify(baseline)&&writes.length===0,'Annuler a modifié le serveur')
  // Add every numeric inventory type; all remain staged even in collapsed families.
  for(const [category,values] of [
   ['dumbbell_fixed',[2,12]],['dumbbell_loadable',[2,2]],['dumbbell_plate',[4,1.25]],
   ['barbell',[1,20]],['ez_bar',[1,8]],['plate',[2,5]],['dumbbell_adjustable',[2,2,30,2]],
   ['kettlebell',[2,24]],['resistance_band',[2,8,20]]]) {
   const group=page.locator(`[data-category="${category}"]`)
   await group.evaluate(e=>{const family=e.closest('details');if(!family.open)family.querySelector('summary').click()})
   await group.getByRole('button' ,{name:/Ajouter une ligne/}).click()
   const row=group.locator('.dumbbell-row').last()
   for(let n=0;n<values.length;n++)await row.locator('input').nth(n).fill(String(values[n]))
   assert(await row.getByRole('button').count()===1,'Bouton de validation restant')
  }
  await page.getByRole('button',{name:'Ajouter un équipement personnalisé',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByLabel('Nom',{exact:true}).fill('Mon accessoire')
  await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click();await dialog.waitFor({state:'hidden'})
  assert(writes.length===0,'Ajout personnalisé enregistré avant sauvegarde globale')
  await page.getByRole('searchbox',{name:'Rechercher du matériel…'}).fill('presse')
  await page.getByRole('checkbox',{name:'Presse à cuisses',exact:true}).check()
  await page.getByRole('searchbox',{name:'Rechercher du matériel…'}).fill('')
  await page.locator('[data-family="free_weights"] > summary').evaluate(e=>{if(e.parentElement.open)e.click()})
  for(const width of [320,390,768,1280]) {
   await page.setViewportSize({width,height:844})
   const before=await dock.boundingBox()
   await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight))
   const after=await dock.boundingBox(),nav=await page.locator('.bottom-nav').boundingBox()
   assert(Math.abs(before.y-after.y)<1&&after.y+after.height<nav.y,'Barre pas fixe au-dessus de la navbar')
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Débordement mobile')
   layouts.push(width)
  }
  await page.locator('.exercise-tabs__btn').filter({hasText:'Douleurs'}).click()
  await page.locator('.pain-grid').waitFor()
  assert(!await dock.isVisible(),'Barre matériel visible sur Douleurs')
  await page.locator('.exercise-tabs__btn').filter({hasText:'Matériel'}).click();await dock.waitFor()
  failNext=true
  await dock.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.waitForTimeout(100)
  assert(await dock.isVisible(),'Erreur perd le brouillon')
  assert(JSON.stringify(items)===JSON.stringify(baseline),'Erreur modifie les données')
  await dock.getByRole('button',{name:'Enregistrer',exact:true}).click();await dock.waitFor({state:'hidden'})
  assert(writes.length===2,'Enregistrement non groupé')
  assert(items.length===15,'Lignes cachées ou nouveaux équipements perdus')
  assert(items.find(item=>item.id===1).notes==='preserve','Notes existantes perdues')
  assert(items.some(item=>item.category==='other'&&item.name==='Mon accessoire'),'Personnalisé perdu')
  await page.reload();await page.locator('.inventory-family').first().waitFor()
  assert(await dock.count()===0,'Brouillon fictif après rechargement')
  assert(errors.length===0,'Erreur JavaScript')
  return {rowCrossOnly:true,stagedRowsAndCheckboxes:true,customStaged:true,cancelRestores:true,allNumericModes:true,draftsAcrossTabs:true,atomicSave:true,retryKeptDraft:true,layouts,errors}
 }finally {page.removeListener('pageerror',onError);await page.unroute('http://workoutbuddy.test/api/v1/equipment**',handler)}
}
