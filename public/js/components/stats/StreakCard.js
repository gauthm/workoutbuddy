import { t } from '../../i18n.js'

export default {
  name: 'StreakCard',
  props: {
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    totalSessions: { type: Number, default: 0 },
    totalWeeks:    { type: Number, default: 0 },
  },
  setup() { return { t } },
  template: `
    <div class="streak-card">
      <div class="streak-card__main">
        <span class="streak-card__fire">🔥</span>
        <div>
          <div class="streak-card__current">{{ currentStreak }}</div>
          <div class="streak-card__label">{{ t('stats.current_streak') }}</div>
        </div>
      </div>
      <div class="streak-card__grid">
        <div class="streak-card__stat">
          <div class="streak-card__stat-value">{{ longestStreak }}</div>
          <div class="streak-card__stat-label">{{ t('stats.longest_streak') }}</div>
        </div>
        <div class="streak-card__stat">
          <div class="streak-card__stat-value">{{ totalSessions }}</div>
          <div class="streak-card__stat-label">{{ t('stats.sessions_total') }}</div>
        </div>
        <div class="streak-card__stat">
          <div class="streak-card__stat-value">{{ totalWeeks }}</div>
          <div class="streak-card__stat-label">{{ t('stats.weeks_trained') }}</div>
        </div>
      </div>
    </div>
  `
}
