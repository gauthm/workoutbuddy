async page => {
  const draft={"name":"Forme générale · 3 j/sem","goal":"general_fitness","level":"beginner","days_per_week":3,"duration_weeks":8,"progression_model":"double_progression","use_exercise_rotation":0,"deload_auto_enabled":1,"templates":[{"name":"Corps entier A","day_of_week":null,"estimated_duration_min":17,"exercises":[{"exercise_id":"pushups","target_sets":2,"target_reps_min":8,"target_reps_max":12,"rest_seconds":90,"progression_model":"inherit","rir_target":2,"name_fr":"Pushups","name_en":"Pushups"},{"exercise_id":"bodyweight_squat","target_sets":2,"target_reps_min":8,"target_reps_max":12,"rest_seconds":90,"progression_model":"inherit","rir_target":2,"name_fr":"Bodyweight Squat","name_en":"Bodyweight Squat"},{"exercise_id":"crunches","target_sets":2,"target_reps_min":10,"target_reps_max":15,"rest_seconds":75,"progression_model":"inherit","rir_target":2,"name_fr":"Crunches","name_en":"Crunches"}]},{"name":"Corps entier B","day_of_week":null,"estimated_duration_min":17,"exercises":[{"exercise_id":"pushups","target_sets":2,"target_reps_min":8,"target_reps_max":12,"rest_seconds":90,"progression_model":"inherit","rir_target":2,"name_fr":"Pushups","name_en":"Pushups"},{"exercise_id":"bodyweight_squat","target_sets":2,"target_reps_min":8,"target_reps_max":12,"rest_seconds":90,"progression_model":"inherit","rir_target":2,"name_fr":"Bodyweight Squat","name_en":"Bodyweight Squat"},{"exercise_id":"crunches","target_sets":2,"target_reps_min":10,"target_reps_max":15,"rest_seconds":75,"progression_model":"inherit","rir_target":2,"name_fr":"Crunches","name_en":"Crunches"}]},{"name":"Corps entier C","day_of_week":null,"estimated_duration_min":17,"exercises":[{"exercise_id":"pushups","target_sets":2,"target_reps_min":8,"target_reps_max":12,"rest_seconds":90,"progression_model":"inherit","rir_target":2,"name_fr":"Pushups","name_en":"Pushups"},{"exercise_id":"bodyweight_squat","target_sets":2,"target_reps_min":8,"target_reps_max":12,"rest_seconds":90,"progression_model":"inherit","rir_target":2,"name_fr":"Bodyweight Squat","name_en":"Bodyweight Squat"},{"exercise_id":"bent_knee_hip_raise","target_sets":2,"target_reps_min":8,"target_reps_max":12,"rest_seconds":90,"progression_model":"inherit","rir_target":2,"name_fr":"Bent-Knee Hip Raise","name_en":"Bent-Knee Hip Raise"}]}],"warnings":[{"code":"muscle_unavailable","muscle":"back"},{"code":"muscle_unavailable","muscle":"hamstrings"},{"code":"muscle_unavailable","muscle":"shoulders"}]}
  const writes=[],errors=[],checks=[];let created=0, previewFails=true
  page.on('pageerror',err=>errors.push(err.message))
  const assert=(value,message)=>{if(!value)throw new Error(message)}
  await page.route('http://workoutbuddy.test/api/v1/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname
    if(request.method()!=='GET')writes.push({path,body:request.postDataJSON()})
    let body={}
    if(path==='/api/v1/user-profile')body={onboarding_completed:false}
    else if(path==='/api/v1/equipment')body={items:[]}
    else if(path==='/api/v1/programs/preview'){
      if(previewFails){previewFails=false;return route.fulfill({status:400,json:{error:'NO_AVAILABLE_EXERCISES'}})}
      body=draft
    } else if(path==='/api/v1/programs/generate'){created++;body={...draft,id:999}}
    else if(path==='/api/v1/programs/999')body={...draft,id:999,plan:{parameters:{}},is_active:false}
    else if(path==='/api/v1/ai/conversations')body={conversations:[]}
    else if(path==='/api/v1/ai/advice')body={advice:[]}
    else if(path==='/api/v1/settings')body={language:'fr',theme:'dark'}
    else if(path==='/api/v1/programs')body={programs:[]}
    else return route.fallback()
    return route.fulfill({status:request.method()==='POST'?201:200,json:body})
  })
  await page.setViewportSize({width:390,height:844});await page.goto('http://workoutbuddy.test/#/programs/new')
  await page.getByRole('heading',{name:'Quel est ton objectif principal ?'}).waitFor()
  const validateLayout=async()=>{
    const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}))
    assert(width.scroll<=width.view,'Horizontal overflow')
  }
  await validateLayout();await page.getByRole('button',{name:'Continuer',exact:true}).click()
  assert(await page.getByRole('radio').count()===3,'Level choices')
  await page.getByRole('button',{name:'Continuer',exact:true}).click()
  await page.getByRole('radio',{name:'3 séances / semaine',exact:true}).check()
  await page.getByRole('button',{name:'Continuer',exact:true}).click()
  await page.getByRole('radio',{name:'45 minutes',exact:true}).check()
  await page.getByRole('button',{name:'Continuer',exact:true}).click()
  await page.getByRole('heading',{name:'Quel est ton poids et ta taille ?'}).waitFor()
  await page.locator('#program-weight').fill('80');await page.locator('#program-height').fill('180')
  await page.getByRole('button',{name:'Continuer',exact:true}).click()
  const boxes=page.getByRole('checkbox');await boxes.nth(0).check();await boxes.nth(1).check()
  assert(await boxes.nth(2).isDisabled(),'Two priorities maximum')
  await page.getByRole('button',{name:'Tout le corps, sans priorité particulière'}).click()
  await page.getByRole('button',{name:'Continuer',exact:true}).click()
  await page.getByRole('button',{name:'Régler mon matériel'}).click()
  await page.getByRole('dialog').waitFor();await page.getByRole('dialog').getByRole('button',{name:'Fermer',exact:true}).click()
  await page.getByRole('button',{name:'Continuer',exact:true}).click()
  await page.getByRole('button',{name:'Continuer',exact:true}).click()
  await page.getByRole('alert').waitFor()
  assert(await page.getByRole('heading',{name:'Sur combien de semaines ?'}).isVisible(),'Failure preserves answers and step')
  await page.getByRole('button',{name:'Continuer',exact:true}).click()
  await page.getByRole('heading',{name:'Voici ton programme'}).waitFor()
  await validateLayout()
  await page.getByRole('button',{name:'Retour',exact:true}).last().click()
  assert(await page.getByRole('radio',{name:'8 semaines',exact:true}).isChecked(),'Back retains answers')
  await page.getByRole('button',{name:'Continuer',exact:true}).click()
  await page.getByRole('button',{name:'Créer ce programme'}).click()
  await page.waitForURL('**/#/programs/999')
  assert(created===1,'One creation')
  assert(writes.every(w=>['/api/v1/programs/preview','/api/v1/programs/generate'].includes(w.path)),'No chat or profile writes during questionnaire')
  checks.push('Questions, selection limits, equipment dialog, retry, preview, back and creation')
  await page.goto('http://workoutbuddy.test/#/coach');await page.getByText('Le conseiller explique tes progrès', {exact:false}).waitFor()
  assert(await page.locator('.action-preview').count()===0,'No executable actions')
  assert(await page.locator('.onboarding-banner').count()===0,'No chat onboarding')
  checks.push('Read-only advisor without onboarding or action controls')
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:844});await page.goto('http://workoutbuddy.test/#/programs/new');await page.getByRole('heading',{name:'Quel est ton objectif principal ?'}).waitFor();await validateLayout()
  }
  assert(errors.length===0,errors.join('\n'))
  return {checks,layouts:4,writes:writes.length,errors}
}
