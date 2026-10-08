import { inject } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'

const GOAL_FR = {
  strength: 'Force', hypertrophy: 'Masse musculaire', endurance: 'Endurance',
  weight_loss: 'Perte de poids', general_fitness: 'Forme générale',
  sport_performance: 'Performance sportive',
}
const LEVEL_FR = {
  beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé', athlete: 'Athlète'
}

export default {
  name: 'UserProfileCard',
  props: { profile: { type: Object, required: true } },
  setup() {
    const router = inject('router')
    return { t, router, GOAL_FR, LEVEL_FR }
  },
  template: `
    <div class="profile-card">
      <div class="profile-card__header">
        <span class="profile-card__title">{{ t('coach.profile_title') }}</span>
        <button class="btn btn--secondary profile-card__edit"
          @click="router.push('#/settings')">
          {{ t('coach.profile_edit') }}
        </button>
      </div>
      <div v-if="!profile.fitness_level" class="profile-card__incomplete">
        {{ t('coach.profile_incomplete') }}
      </div>
      <div v-else class="profile-card__grid">
        <div class="profile-card__item" v-if="profile.display_name">
          <span class="profile-card__label">Prénom</span>
          <span class="profile-card__value">{{ profile.display_name }}</span>
        </div>
        <div class="profile-card__item">
          <span class="profile-card__label">Niveau</span>
          <span class="profile-card__value">{{ LEVEL_FR[profile.fitness_level] || profile.fitness_level }}</span>
        </div>
        <div class="profile-card__item">
          <span class="profile-card__label">Objectif</span>
          <span class="profile-card__value">{{ GOAL_FR[profile.primary_goal] || profile.primary_goal }}</span>
        </div>
        <div class="profile-card__item" v-if="profile.sessions_per_week">
          <span class="profile-card__label">Séances</span>
          <span class="profile-card__value">{{ profile.sessions_per_week }}/sem · {{ profile.session_duration_min || '?' }}min</span>
        </div>
        <div class="profile-card__item" v-if="profile.weight_kg">
          <span class="profile-card__label">Morphologie</span>
          <span class="profile-card__value">{{ profile.weight_kg }}kg · {{ profile.height_cm }}cm</span>
        </div>
        <div class="profile-card__item" v-if="profile.injury_notes">
          <span class="profile-card__label">⚠️ Limitations</span>
          <span class="profile-card__value">{{ profile.injury_notes }}</span>
        </div>
      </div>
    </div>
  `
}
