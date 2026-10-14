import { test as base,expect } from './runtime.js'
import { isolatedApp } from './environment.js'
export const test=base.extend({
  app:async({},use,info)=>{
    const app=await isolatedApp()
    try {await use(app)} finally {
      const log=info.outputPath('server.log')
      await app.dispose(log)
      if(info.status!==info.expectedStatus)await info.attach('server.log',{path:log,contentType:'text/plain'})
    }
  },
  baseURL:async({app},use)=>use(app.url),
  page:async({page},use)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message))
    await use(page)
    expect(errors,'Unexpected browser JavaScript errors').toEqual([])
  },
})
export {expect}
