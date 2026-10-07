export default {
  name: 'EmptyState',
  props: {
    icon:    { type: String, default: '📭' },
    message: { type: String, required: true },
  },
  template: `
    <div class="empty-state">
      <div class="empty-state__icon">{{ icon }}</div>
      <p class="empty-state__message">{{ message }}</p>
      <slot />
    </div>
  `
}
