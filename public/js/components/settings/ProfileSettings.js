import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { userProfile as api } from '../../api.js'
import { t } from '../../i18n.js'

// Champs du formulaire (secondary_goals, target_weight_kg et
// medical_notes ne sont PAS édités ici — gérés par le coach ;
// le reset, lui, efface tout).
export default {
  name: 'ProfileSettings',

  setup() {
    const store = inject('store')

    const state = reactive({
      loading: true, error: null, saving: false,
      form: {
        display_name: '', age: '', sex: '', weight_kg: '', height_cm: '',
        fitness_level: '', primary_goal: '', sessions_per_week: '',
        session_duration_min: '', prefers_exercise_variation: true,
        injury_notes: '', sport_practiced: '',
      },
      showReset: false, confirmText: '', resetting: false,
    })

    function toInput(v) { return v === null || v === undefined ? '' : v }

    async function load() {
      state.loading = true; state.error = null
      try {
        const p = await api.get()
        state.form = {
          display_name:               toInput(p.display_name),
          age:                        toInput(p.age),
          sex:                        toInput(p.sex),
          weight_kg:                  toInput(p.weight_kg),
          height_cm:                  toInput(p.height_cm),
          fitness_level:              toInput(p.fitness_level),
          primary_goal:               toInput(p.primary_goal),
          sessions_per_week:          toInput(p.sessions_per_week),
          session_duration_min:       toInput(p.session_duration_min),
          prefers_exercise_variation: p.prefers_exercise_variation ?? true,
          injury_notes:               toInput(p.injury_notes),
          sport_practiced:            toInput(p.sport_practiced),
        }
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    function buildPayload() {
      const f = state.form
      const payload = {
        display_name:              f.display_name.trim() || null,
        age:                       f.age !== '' ? Number(f.age) : null,
        sex:                       f.sex || null,
        weight_kg:                 f.weight_kg !== '' ? Number(f.weight_kg) : null,
        height_cm:                 f.height_cm !== '' ? Number(f.height_cm) : null,
        fitness_level:             f.fitness_level || null,
        primary_goal:              f.primary_goal || null,
        sessions_per_week:         f.sessions_per_week !== '' ? Number(f.sessions_per_week) : null,
        session_duration_min:      f.session_duration_min !== '' ? Number(f.session_duration_min) : null,
        prefers_exercise_variation: f.prefers_exercise_variation,
        injury_notes:              f.injury_notes.trim() || null,
        sport_practiced:           f.sport_practiced.trim() || null,
      }
      return payload
    }

    async function save() {
      state.saving = true
      try {
        await api.save(buildPayload())
        store.showToast(t('settings.profile_saved'), 'success')
      } catch (err) {
        store.showToast(err.detail?.join('; ') || err.message, 'error')
      } finally { state.saving = false }
    }

    async function confirmReset() {
      if (state.confirmText !== 'RESET') return
      state.resetting = true
      try {
        await api.reset()
        await load()                       // recharger le formulaire vidé
        state.showReset   = false
        state.confirmText = ''
        store.showToast(t('settings.profile_reset_done'), 'success')
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally { state.resetting = false }
    }

    onMounted(load)
    return { state, load, save, confirmReset, t }
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
          <label class="setting-row__label">{{ t('settings.profile_display_name') }}</label>
          <input class="form-input setting-row__control" type="text"
            v-model="state.form.display_name" autocomplete="off" />
        </div>

        <div class="setting-row">
          <label class="setting-row__label">{{ t('settings.profile_age') }}</label>
          <input class="form-input setting-row__control setting-row__control--sm" type="number"
            min="10" max="100" step="1" v-model="state.form.age" />
        </div>

        <div class="setting-row">
          <label class="setting-row__label">{{ t('settings.profile_sex') }}</label>
          <select class="form-select setting-row__control" v-model="state.form.sex">
            <option value="">{{ t('settings.profile_sex_unspecified') }}</option>
            <option value="male">{{ t('settings.profile_sex_male') }}</option>
            <option value="female">{{ t('settings.profile_sex_female') }}</option>
            <option value="other">{{ t('settings.profile_sex_other') }}</option>
            <option value="prefer_not_to_say">{{ t('settings.profile_sex_undisclosed') }}</option>
          </select>
        </div>

        <div class="setting-row">
          <label class="setting-row__label">{{ t('settings.profile_weight') }}</label>
          <input class="form-input setting-row__control setting-row__control--sm" type="number"
            min="20" max="500" step="0.5" v-model="state.form.weight_kg" />
        </div>

        <div class="setting-row">
          <label class="setting-row__label">{{ t('settings.profile_height') }}</label>
          <input class="form-input setting-row__control setting-row__control--sm" type="number"
            min="50" max="280" step="1" v-model="state.form.height_cm" />
        </div>

        <div class="setting-row">
          <label class="setting-row__label">{{ t('settings.profile_level') }}</label>
          <select class="form-select setting-row__control" v-model="state.form.fitness_level">
            <option value="">{{ t('settings.profile_level_unspecified') }}</option>
            <option value="beginner">{{ t('settings.profile_level_beginner') }}</option>
            <option value="intermediate">{{ t('settings.profile_level_intermediate') }}</option>
            <option value="advanced">{{ t('settings.profile_level_advanced') }}</option>
            <option value="athlete">{{ t('settings.profile_level_athlete') }}</option>
          </select>
        </div>

        <div class="setting-row">
          <label class="setting-row__label">{{ t('settings.profile_goal') }}</label>
          <select class="form-select setting-row__control" v-model="state.form.primary_goal">
            <option value="">{{ t('settings.profile_goal_unspecified') }}</option>
            <option value="strength">{{ t('settings.profile_goal_strength') }}</option>
            <option value="hypertrophy">{{ t('settings.profile_goal_hypertrophy') }}</option>
            <option value="endurance">{{ t('settings.profile_goal_endurance') }}</option>
            <option value="weight_loss">{{ t('settings.profile_goal_weight_loss') }}</option>
            <option value="general_fitness">{{ t('settings.profile_goal_general_fitness') }}</option>
            <option value="sport_performance">{{ t('settings.profile_goal_sport_performance') }}</option>
          </select>
        </div>

        <div class="setting-row">
          <label class="setting-row__label">{{ t('settings.profile_sessions') }}</label>
          <input class="form-input setting-row__control setting-row__control--sm" type="number"
            min="1" max="7" step="1" v-model="state.form.sessions_per_week" />
        </div>

        <div class="setting-row">
          <label class="setting-row__label">{{ t('settings.profile_duration') }}</label>
          <input class="form-input setting-row__control setting-row__control--sm" type="number"
            min="15" max="240" step="5" v-model="state.form.session_duration_min" />
        </div>

        <div class="setting-row setting-row--switch">
          <label class="setting-row__label">{{ t('settings.profile_variation') }}</label>
          <input type="checkbox" class="setting-row__switch"
            v-model="state.form.prefers_exercise_variation" />
        </div>

        <div class="setting-row profile-settings__row-textarea">
          <label class="setting-row__label">{{ t('settings.profile_injuries') }}</label>
          <textarea class="form-textarea" rows="2" v-model="state.form.injury_notes"></textarea>
        </div>

        <div class="setting-row">
          <label class="setting-row__label">{{ t('settings.profile_sport') }}</label>
          <input class="form-input setting-row__control" type="text"
            v-model="state.form.sport_practiced" autocomplete="off" />
        </div>

        <button class="btn btn--primary btn--full"
          :disabled="state.saving" @click="save()">
          {{ state.saving ? t('common.loading') : t('settings.profile_save') }}
        </button>

        <button class="btn btn--danger btn--full profile-settings__reset"
          @click="state.showReset = true">
          {{ t('settings.profile_reset') }}
        </button>

        <!-- Modale de double confirmation -->
        <div v-if="state.showReset" class="modal-overlay"
          @click.self="state.showReset = false; state.confirmText = ''">
          <div class="modal">
            <h2 class="modal__title" style="color:var(--color-danger)">
              ⚠️ {{ t('settings.profile_reset_title') }}
            </h2>
            <p class="modal__body">{{ t('settings.profile_reset_body') }}</p>
            <div class="form-group">
              <label class="form-label">{{ t('settings.reset_stats_prompt', { word: 'RESET' }) }}</label>
              <input class="form-input" type="text"
                v-model="state.confirmText" placeholder="RESET" autocomplete="off" />
            </div>
            <div class="modal__actions">
              <button class="btn btn--secondary"
                @click="state.showReset = false; state.confirmText = ''">
                {{ t('common.cancel') }}
              </button>
              <button class="btn btn--danger"
                :disabled="state.confirmText !== 'RESET' || state.resetting"
                @click="confirmReset()">
                {{ state.resetting ? t('common.loading') : t('settings.profile_reset_confirm_btn') }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  `
}
