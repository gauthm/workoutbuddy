import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trackMobileKeyboard } from '../../public/js/utils/mobileKeyboard.js'

function environment(touch = true) {
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 })
  const classes = new Set(), styles = new Map()
  const doc = Object.assign(new EventTarget(), {
    activeElement: null,
    documentElement: {
      classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name) }, remove(name) { classes.delete(name) } },
      style: { setProperty: (key, value) => styles.set(key, value), removeProperty: key => styles.delete(key) },
    },
  })
  let callback
  const win = Object.assign(new EventTarget(), {
    visualViewport: viewport, innerHeight: 844, innerWidth: 390,
    matchMedia: () => ({ matches: touch }),
    requestAnimationFrame(fn) { callback = fn; return 1 },
    cancelAnimationFrame() { callback = null },
  })
  const update = (height, layoutHeight = 844) => {
    viewport.height = height; win.innerHeight = layoutHeight
    viewport.dispatchEvent(new Event('resize'))
    const pending = callback; callback = null; pending?.()
  }
  return { win, doc, viewport, classes, styles, update,
    focus() { doc.activeElement = { matches: () => true } },
  }
}

test('keyboard visibility follows occlusion, keeps dismissal hidden and cleans up listeners', () => {
  const e = environment(), stop = trackMobileKeyboard(e.win, e.doc)
  e.focus()
  e.update(784)
  assert.equal(e.classes.has('keyboard-open'), false)
  e.viewport.offsetTop = 80
  e.update(524)
  assert.equal(e.classes.has('keyboard-open'), true)
  assert.equal(e.styles.get('--keyboard-viewport-top'), '80px')
  assert.equal(e.styles.get('--keyboard-viewport-height'), '524px')
  e.doc.activeElement = null
  e.update(524)
  assert.equal(e.classes.has('keyboard-open'), true)
  e.update(844)
  assert.equal(e.classes.has('keyboard-open'), false)
  stop()
  assert.equal(e.styles.size, 0)
  e.focus(); e.update(524)
  assert.equal(e.classes.has('keyboard-open'), false)
})

test('keyboard is detected when the browser also resizes the layout viewport', () => {
  const e = environment()
  trackMobileKeyboard(e.win, e.doc)
  e.focus(); e.update(524, 524)
  assert.equal(e.classes.has('keyboard-open'), true)
  e.update(844)
  assert.equal(e.classes.has('keyboard-open'), false)
})

test('desktop, pinch zoom, rotation and unsupported browsers keep navigation available', () => {
  const desktop = environment(false)
  trackMobileKeyboard(desktop.win, desktop.doc)
  desktop.focus(); desktop.update(524)
  assert.equal(desktop.classes.size, 0)
  const e = environment()
  trackMobileKeyboard(e.win, e.doc)
  e.focus(); e.viewport.scale = 2; e.update(422)
  assert.equal(e.classes.has('keyboard-open'), false)
  e.viewport.scale = 1; e.win.innerWidth = 844; e.update(390, 390)
  assert.equal(e.classes.has('keyboard-open'), false)
  e.win.visualViewport = null
  assert.doesNotThrow(() => trackMobileKeyboard(e.win, e.doc)())
})
