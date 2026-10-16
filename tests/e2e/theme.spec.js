import {test,expect} from './fixtures.js'
import {L,pending,call,planned,startThroughUI} from './helpers.js'

async function contrast(page,selectors) {
  return page.evaluate(selectors=>{
    const rgba=value=>{const n=value.match(/[\d.]+/g).map(Number);return [...n.slice(0,3),n[3] ?? 1]}
    const blend=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*fg[3]+bg[i]*(1-fg[3]))
    const background=element=>{
      const parents=[];for(let e=element;e;e=e.parentElement)parents.unshift(e)
      return parents.reduce((bg,e)=>blend(rgba(getComputedStyle(e).backgroundColor),bg),[255,255,255])
    }
    const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)
    const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
    return selectors.flatMap(selector=>Array.from(document.querySelectorAll(selector)).filter(e=>e.getClientRects().length).map(e=>{
      const style=getComputedStyle(e),bg=background(e)
      return {selector,contrast:ratio(blend(rgba(style.color),bg),bg),border:ratio(rgba(style.borderTopColor).slice(0,3),bg)}
    }))
  },selectors)
}

test('thème clair : contraste des textes, actions, alertes et champs, focus visible et préférence persistante',async({page,request},info)=>{
 await page.goto('/#/settings')
 await page.getByText(L('settings.section_general'),{exact:true}).click()
 await page.locator('#SettingsView-state-settings-theme').selectOption('light')
 await pending(page).getByRole('button',{name:L('common.save'),exact:true}).click()
 await expect(page.locator('html')).toHaveAttribute('data-theme','light')
 await page.getByText(L('settings.section_profile'),{exact:true}).click()
 const input=page.getByLabel(L('settings.profile_display_name'),{exact:true})
 await input.focus()
 await expect(input).toHaveCSS('outline-style','solid')
 await expect(input).toHaveCSS('outline-width','2px')
 await page.getByText(L('settings.section_advanced'),{exact:true}).click()
 const results=await contrast(page,['.setting-row__label','.form-label','.form-select','.form-input','.btn:not(:disabled)','.bottom-nav__tab','.settings-section__title','.export-import__label','.export-import__hint'])
 expect(results.length).toBeGreaterThan(20)
 for(const row of results)expect(row.contrast,`${row.selector} text`).toBeGreaterThanOrEqual(4.5)
 for(const row of results.filter(row=>['.form-select','.form-input'].includes(row.selector)))expect(row.border,`${row.selector} boundary`).toBeGreaterThanOrEqual(3)
 await page.screenshot({path:info.outputPath('settings-light.png'),fullPage:true})
 await page.reload()
 await expect(page.locator('html')).toHaveAttribute('data-theme','light')
 await page.goto('/#/')
 for(const row of await contrast(page,['.btn--primary','.btn--secondary','.calendar-legend','.calendar-cell--other-month','.bottom-nav__tab']))expect(row.contrast,row.selector).toBeGreaterThanOrEqual(4.5)
 await expect(page.locator('.calendar-cell--other-month').first()).toHaveCSS('opacity','1')
 await page.screenshot({path:info.outputPath('home-light.png'),fullPage:true})
})

test('thème clair : les valeurs validées en séance restent lisibles',async({page,request},info)=>{
 await call(request,'put','/settings',{theme:'light'})
 const program=await planned(request)
 await startThroughUI(page,program)
 const block=page.locator('.exercise-block').first()
 if(!await block.locator('.set-row').first().isVisible())await block.locator('.exercise-block__toggle').click()
 const row=block.locator('.set-row:not(.set-row--warmup)').first()
 await row.locator('input').nth(0).fill('10')
 await row.locator('input').nth(1).fill('10')
 await row.getByRole('button',{name:/Valider la série/}).click()
 await expect(row.getByRole('button',{name:/Annuler la série/})).toBeVisible()
 await expect(row.locator('input').first()).toHaveCSS('opacity','1')
 for(const value of await contrast(page,['.set-row--done .set-row__input','.set-row__10rm','.exercise-block__subtitle']))expect(value.contrast,value.selector).toBeGreaterThanOrEqual(4.5)
 await page.screenshot({path:info.outputPath('session-light.png'),fullPage:true})
})
