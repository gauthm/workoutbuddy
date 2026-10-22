// Keep shared navigation out of the visual viewport while a touch keyboard is open.
export function trackMobileKeyboard(win = window, doc = document) {
  const viewport = win.visualViewport
  if (!viewport || !win.matchMedia('(any-pointer: coarse)').matches) return () => {}

  const root = doc.documentElement
  let baseline = Math.max(win.innerHeight, viewport.height)
  let width = win.innerWidth
  let open = false
  let frame = 0
  const editable = () => {
    const element = doc.activeElement
    return element?.matches('textarea, input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="hidden"])') || element?.isContentEditable
  }

  function update() {
    frame = 0
    // Rotation establishes a new baseline; address-bar changes are below the threshold.
    if (width !== win.innerWidth) {
      width = win.innerWidth
      baseline = win.innerHeight
    }
    if (!open && !editable()) baseline = Math.max(win.innerHeight, viewport.height)
    const obscured = Math.max(baseline, win.innerHeight) - viewport.height
    open = viewport.scale === 1 && obscured > 120 && (editable() || open)
    root.classList.toggle('keyboard-open', open)
    root.style.setProperty('--keyboard-viewport-height', `${viewport.height}px`)
    root.style.setProperty('--keyboard-viewport-top', `${viewport.offsetTop}px`)
  }

  function schedule() {
    if (!frame) frame = win.requestAnimationFrame(update)
  }
  const listeners = [[viewport, 'resize'], [viewport, 'scroll'], [win, 'resize'],
    [doc, 'focusin'], [doc, 'focusout']]
  for (const [target, event] of listeners) target.addEventListener(event, schedule)
  update()
  return () => {
    for (const [target, event] of listeners) target.removeEventListener(event, schedule)
    if (frame) win.cancelAnimationFrame(frame)
    root.classList.remove('keyboard-open')
    root.style.removeProperty('--keyboard-viewport-height')
    root.style.removeProperty('--keyboard-viewport-top')
  }
}
