import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { download, FILES } from '../../scripts/download-vendors.js'

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-vendors-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  return directory
}

test('vendor installation replaces old versions and reuses the pinned versions offline', async t => {
  const vendorDir = temporary(t)
  for (const file of FILES) fs.writeFileSync(path.join(vendorDir, file.dest), '/* old version */')
  const requests = []
  await download({ vendorDir, fetchImpl: async url => {
    requests.push(url)
    const file = FILES.find(file => file.url === url)
    return { ok: true, text: async () => `/* ${file.marker} */\nnew library` }
  } })
  assert.equal(requests.length, FILES.length)
  for (const file of FILES) assert.match(fs.readFileSync(path.join(vendorDir, file.dest), 'utf8'), /new library/)
  await download({ vendorDir, fetchImpl: () => { throw new Error('Must not request installed versions') } })
})

test('failed or unexpected downloads preserve an existing library', async t => {
  const vendorDir = temporary(t)
  const target = path.join(vendorDir, FILES[0].dest)
  fs.writeFileSync(target, 'previous working library')
  for (const response of [
    { ok: false, status: 503 },
    { ok: true, text: async () => '<html>unexpected response</html>' },
  ]) {
    await assert.rejects(download({ vendorDir, fetchImpl: async () => response }))
    assert.equal(fs.readFileSync(target, 'utf8'), 'previous working library')
    assert.equal(fs.existsSync(`${target}.tmp`), false)
  }
})
