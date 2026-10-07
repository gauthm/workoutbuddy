import { inject } from '/vendor/vue.esm-browser.prod.js'

export default {
  name: 'PageHeader',
  props: {
    title:    { type: String, required: true },
    showBack: { type: Boolean, default: false },
  },

  setup() {
    const router = inject('router')
    return { router }
  },

  template: `
    <header class="page-header">
      <button v-if="showBack" class="page-header__back" @click="router.back()">‹</button>
      <h1 class="page-header__title">{{ title }}</h1>
      <div class="page-header__actions">
        <slot name="actions" />
      </div>
    </header>
  `
}
