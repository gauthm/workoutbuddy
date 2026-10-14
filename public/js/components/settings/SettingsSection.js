import { ref } from '/vendor/vue.esm-browser.prod.js'

export default {
  name: 'SettingsSection',
  props: {
    title:       { type: String, required: true },
    defaultOpen: { type: Boolean, default: false },
  },
  setup(props) {
    const open = ref(props.defaultOpen)
    return { open }
  },
  template: `
    <div class="settings-section">
      <button class="settings-section__toggle" :aria-expanded="open" @click="open = !open">
        <span class="settings-section__title">{{ title }}</span>
        <span class="settings-section__chevron" aria-hidden="true">{{ open ? '▲' : '▼' }}</span>
      </button>
      <div v-show="open" class="settings-section__body">
        <slot />
      </div>
    </div>
  `
}
