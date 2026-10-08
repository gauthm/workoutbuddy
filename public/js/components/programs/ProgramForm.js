import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { programs as api } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'

const GOALS  = ['strength','hypertrophy','endurance','weight_loss','general_fitness']
const LEVELS = ['beginner','intermediate','advanced']

export default {
  name: 'ProgramForm',
  props: { id: { type: String, default: null } },
  components: { PageHeader, LoadingSpinner },

  setup(props) {
    const router = inject('router')
    const store  = inject('store')
    const isEdit = !!props.id

    const state = reactive({
      loading: isEdit, saving: false, error: null,
      form: {
        name: '', goal: 'hypertrophy', level: 'intermediate',
        days_per_week: 3, duration_weeks: '',
        progression_model: 'double_progression',
        deload_auto_enabled: false, deload_frequency_weeks: 6,
      }
    })

    async function load() {
      if (!isEdit) { state.loading = false; return }
      try {
        const p = await api.get(props.id)
        Object.assign(state.form, {
          name: p.name, goal: p.goal, level: p.level,
          days_per_week: p.days_per_week,
          duration_weeks: p.duration_weeks || '',
          progression_model: p.progression_model,
          deload_auto_enabled: p.deload_auto_enabled,
          deload_frequency_weeks: p.deload_frequency_weeks,
        })
      } catch (err) { state.error = err.message }
      finally { state.loading = false }
    }

    async function save() {
      if (!state.form.name.trim()) {
        store.showToast(t('programs.name_required'), 'error'); return
      }
      state.saving = true
      try {
        const body = {
          ...state.form,
          days_per_week: parseInt(state.form.days_per_week),
          duration_weeks: state.form.duration_weeks
            ? parseInt(state.form.duration_weeks) : null,
        }
        if (isEdit) {
          await api.update(props.id, body)
          store.showToast(t('programs.updated'), 'success')
          router.push('#/programs/' + props.id)
        } else {
          const created = await api.create(body)
          store.showToast(t('programs.created'), 'success')
          router.push('#/programs/' + created.id)
        }
      } catch (err) { store.showToast(err.message, 'error') }
      finally { state.saving = false }
    }

    onMounted(load)
    return { state, save, isEdit, router, t, GOALS, LEVELS }
  },

  template: `
    <div class="view">
      <PageHeader
        :title="isEdit ? t('common.edit') : t('programs.new')"
        :show-back="true" />
      <div class="view__content" style="padding:0 1rem">
        <LoadingSpinner v-if="state.loading" />
        <form v-else @submit.prevent="save">
          <div class="form-group">
            <label class="form-label">{{ t('programs.form_name') }}</label>
            <input class="form-input" v-model="state.form.name" required />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('programs.generator_goal') }}</label>
            <select class="form-select" v-model="state.form.goal">
              <option v-for="g in GOALS" :key="g" :value="g">
                {{ t('programs.goal_' + (g === 'general_fitness' ? 'general' : g)) }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('programs.generator_level') }}</label>
            <select class="form-select" v-model="state.form.level">
              <option v-for="l in LEVELS" :key="l" :value="l">
                {{ t('programs.level_' + l) }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('programs.generator_days') }}</label>
            <select class="form-select" v-model="state.form.days_per_week">
              <option v-for="d in [2,3,4,5,6]" :key="d" :value="d">{{ d }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('programs.form_duration') }}</label>
            <input class="form-input" type="number" min="1" max="52"
              v-model="state.form.duration_weeks"
              :placeholder="t('programs.form_duration_placeholder')" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('programs.form_progression') }}</label>
            <select class="form-select" v-model="state.form.progression_model">
              <option value="linear">{{ t('programs.progression_linear') }}</option>
              <option value="double_progression">{{ t('programs.progression_double') }}</option>
              <option value="rpe_based">{{ t('programs.progression_rpe') }}</option>
            </select>
          </div>
          <button type="submit" class="btn btn--primary btn--full"
            :disabled="state.saving" style="margin-top:1rem">
            {{ state.saving ? t('common.loading') : t('common.save') }}
          </button>
        </form>

        <!-- Bouton génération automatique si création -->
        <div v-if="!isEdit" style="margin-top:1.5rem;text-align:center">
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:0.5rem">
            {{ t('programs.or') }}
          </p>
          <button class="btn btn--secondary btn--full"
            @click="router.push('#/programs/generate')">
            {{ t('programs.generate') }}
          </button>
        </div>
      </div>
    </div>
  `
}
