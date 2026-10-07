export default {
  name: 'Toast',
  props: {
    toast: { type: Object, required: true }
    // toast: { id, message, type:'success'|'error'|'info'|'warning' }
  },
  emits: ['dismiss'],
  template: `
    <div
      class="toast"
      :class="'toast--' + toast.type"
      role="alert"
      @click="$emit('dismiss')"
    >
      {{ toast.message }}
    </div>
  `
}
