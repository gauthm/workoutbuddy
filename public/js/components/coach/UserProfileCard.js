import { inject } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'
export default {
  name:'UserProfileCard',props:{ profile:{type:Object,required:true} },
  setup() { return {t,router:inject('router')} },
  template:`<div class="profile-card">
    <div class="profile-card__header"><span class="profile-card__title">{{ t('coach.profile_title') }}</span>
      <button class="btn btn--secondary profile-card__edit" @click="router.push('#/settings')">{{ t('coach.profile_edit') }}</button></div>
    <div class="profile-card__grid">
      <div v-if="profile.display_name" class="profile-card__item"><span class="profile-card__label">{{ t('settings.profile_display_name') }}</span><span class="profile-card__value">{{ profile.display_name }}</span></div>
      <div v-if="profile.sex" class="profile-card__item"><span class="profile-card__label">{{ t('settings.profile_sex') }}</span><span class="profile-card__value">{{ t('settings.profile_sex_' + (profile.sex === 'prefer_not_to_say' ? 'undisclosed' : profile.sex)) }}</span></div>
      <div v-if="profile.date_of_birth" class="profile-card__item"><span class="profile-card__label">{{ t('settings.profile_birth_date') }}</span><span class="profile-card__value">{{ profile.date_of_birth }}</span></div>
    </div></div>`
}
