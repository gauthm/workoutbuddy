import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VENDOR_DIR = path.join(__dirname, '..', 'public', 'vendor')

const FILES = [
  {
    url: 'https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.esm-browser.prod.js',
    dest: 'vue.esm-browser.prod.js',
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
    dest: 'chart.umd.min.js',
  },
]

async function download() {
  fs.mkdirSync(VENDOR_DIR, { recursive: true })
  for (const { url, dest } of FILES) {
    const destPath = path.join(VENDOR_DIR, dest)
    if (fs.existsSync(destPath)) {
      console.log(`✓ Already present: ${dest}`)
      continue
    }
    console.log(`Downloading: ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    const text = await res.text()
    fs.writeFileSync(destPath, text, 'utf8')
    console.log(`✓ Saved: ${dest}`)
  }
  console.log('Vendor libraries ready.')
}

download().catch(err => {
  console.error('download-vendors error:', err.message)
  process.exit(1)
})
