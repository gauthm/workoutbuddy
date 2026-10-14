import { ref, onMounted, onBeforeUnmount, nextTick } from '/vendor/vue.esm-browser.prod.js'

const dialogs = []
let previousOverflow = ''

export function useDialog(close) {
  const dialogRef = ref(null)
  let previousFocus
  const focusable = () => [...(dialogRef.value?.querySelectorAll(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
  ) || [])].filter(el => el.getClientRects().length)

  function onKeydown(event) {
    if (dialogs.at(-1) !== dialogRef) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') {
      const items = focusable()
      if (!items.length) { event.preventDefault(); dialogRef.value?.focus(); return }
      const first = items[0], last = items.at(-1)
      if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) {
        event.preventDefault(); first.focus()
      }
    }
  }

  onMounted(async () => {
    previousFocus = document.activeElement
    if (!dialogs.length) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    dialogs.push(dialogRef)
    document.addEventListener('keydown', onKeydown)
    await nextTick()
    ;(focusable()[0] || dialogRef.value)?.focus()
  })
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
    const index = dialogs.indexOf(dialogRef)
    if (index >= 0) dialogs.splice(index, 1)
    if (!dialogs.length) document.body.style.overflow = previousOverflow
    if (previousFocus?.isConnected) previousFocus.focus()
  })
  return dialogRef
}
