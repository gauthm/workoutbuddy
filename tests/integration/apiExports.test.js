import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('api.js — frontend exports', () => {

  it('exports userProfile with get and save', async () => {
    const api = await import('../../public/js/api.js')
    assert.ok(api.userProfile, 'missing userProfile export')
    assert.equal(typeof api.userProfile.get, 'function')
    assert.equal(typeof api.userProfile.save, 'function')
  })

  it('CoachView only imports existing api.js exports', async () => {
    const fs = await import('node:fs/promises')
    const [src, api] = await Promise.all([
      fs.readFile(new URL('../../public/js/components/coach/CoachView.js', import.meta.url), 'utf8'),
      import('../../public/js/api.js'),
    ])
    const m = src.match(/import\s*\{([^}]+)\}\s*from\s*'[^']*api\.js'/)
    assert.ok(m, 'api.js import not found in CoachView')
    const names = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)
    for (const name of names) {
      assert.ok(name in api, `export « ${name} » absent de api.js`)
    }
  })
})
