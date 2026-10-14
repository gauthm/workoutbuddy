import { reactive, onMounted, computed } from '/vendor/vue.esm-browser.prod.js'
import { userProfile as api } from '../../api.js'
import { t } from '../../i18n.js'

// Personal identity only; training choices belong to program_plan.
export default {
  name: 'ProfileSettings',

  setup(props, { expose }) {

    const state = reactive({
      loading: true, error: null, baseline: null,
      form: { display_name:'', sex:'', date_of_birth:'' },
    })

    function toInput(v) { return v === null || v === undefined ? '' : v }

    async function load() {
      state.loading = true; state.error = null
      try {
        const p = await api.get()
        acceptSaved(p)
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    function buildPayload() {
      return { display_name:state.form.display_name.trim() || null, sex:state.form.sex || null,
        date_of_birth:state.form.date_of_birth || null }
    }

    const dirty = computed(() => state.baseline !== null && JSON.stringify(state.form) !== JSON.stringify(state.baseline))
    function acceptSaved(p) {
      state.form = { display_name:toInput(p.display_name), sex:toInput(p.sex), date_of_birth:toInput(p.date_of_birth) }
      state.baseline = { ...state.form }
    }
    function reset() { if (state.baseline) state.form = { ...state.baseline } }
    expose({ dirty, getDraft:buildPayload, acceptSaved, reset })

    onMounted(load)
    return { state, load, t, today:new Date().toISOString().slice(0,10) }
  },

  template: `
    <div class="profile-settings">

      <div v-if="state.loading" class="profile-settings__loading">
        {{ t('common.loading') }}
      </div>

      <div v-else-if="state.error" class="settings-notice settings-notice--warning">
        {{ state.error }}
        <button class="btn btn--secondary" @click="load()">{{ t('common.retry') }}</button>
      </div>

      <template v-else>
        <div class="settings-notice profile-settings__notice">
          {{ t('settings.profile_notice') }}
        </div>

        <div class="setting-row">
          <label class="setting-row__label" for="ProfileSettings-state-form-display_name">{{ t('settings.profile_display_name') }}</label>
          <input id="ProfileSettings-state-form-display_name" class="form-input setting-row__control" type="text"
            v-model="state.form.display_name" autocomplete="off" />
        </div>

        <div class="setting-row">
          <label class="setting-row__label" for="ProfileSettings-state-form-sex">{{ t('settings.profile_sex') }}</label>
          <select id="ProfileSettings-state-form-sex" class="form-select setting-row__control" v-model="state.form.sex">
            <option value="">{{ t('settings.profile_sex_unspecified') }}</option>
            <option value="male">{{ t('settings.profile_sex_male') }}</option>
            <option value="female">{{ t('settings.profile_sex_female') }}</option>
            <option value="other">{{ t('settings.profile_sex_other') }}</option>
            <option value="prefer_not_to_say">{{ t('settings.profile_sex_undisclosed') }}</option>
          </select>
        </div>

        <div class="setting-row">
          <label class="setting-row__label" for="profile-birth-date">{{ t('settings.profile_birth_date') }}</label>
          <input id="profile-birth-date" class="form-input setting-row__control" type="date" min="1900-01-01" :max="today" v-model="state.form.date_of_birth" />
        </div>

      </template>
    </div>
  `
}
