import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VENDOR_DIR = path.join(__dirname, '..', 'public', 'vendor')

export const FILES = [
  {
    url: 'https://cdn.jsdelivr.net/npm/vue@3.5.44/dist/vue.esm-browser.prod.js',
    dest: 'vue.esm-browser.prod.js',
    marker: 'vue v3.5.44',
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/chart.js@4.6.1/dist/chart.umd.min.js',
    dest: 'chart.umd.min.js',
    marker: 'Chart.js v4.6.1',
  },
]

export async function download({ vendorDir = VENDOR_DIR, fetchImpl = fetch } = {}) {
  fs.mkdirSync(vendorDir, { recursive: true })
  for (const { url, dest, marker } of FILES) {
    const destPath = path.join(vendorDir, dest)
    if (fs.existsSync(destPath) && fs.readFileSync(destPath, 'utf8').slice(0, 4096).includes(marker)) {
      console.log(`✓ Already present: ${dest}`)
      continue
    }
    console.log(`Downloading: ${url}`)
    const res = await fetchImpl(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    const text = await res.text()
    if (!text.slice(0, 4096).includes(marker)) throw new Error(`Unexpected library version for ${dest}`)
    const temporary = `${destPath}.tmp`
    try {
      fs.writeFileSync(temporary, text, 'utf8')
      fs.renameSync(temporary, destPath)
    } finally {
      fs.rmSync(temporary, { force: true })
    }
    console.log(`✓ Saved: ${dest}`)
  }
  console.log('Vendor libraries ready.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  download().catch(err => {
    console.error('download-vendors error:', err.message)
    process.exitCode = 1
  })
}
