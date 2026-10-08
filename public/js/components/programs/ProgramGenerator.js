import { reactive, inject } from '/vendor/vue.esm-browser.prod.js'
import { programs as api } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader from '../layout/PageHeader.js'

const GOALS   = ['strength','hypertrophy','endurance','weight_loss','general_fitness']
const LEVELS  = ['beginner','intermediate','advanced']
const MUSCLES = ['chest','back','shoulders','biceps','triceps',
                 'quads','hamstrings','glutes','calves','core']

export default {
  name: 'ProgramGenerator',
  components: { PageHeader },

  setup() {
    const router = inject('router')
    const store  = inject('store')

    const state = reactive({
      generating: false,
      form: {
        goal: 'hypertrophy', level: 'intermediate',
        days_per_week: 3, duration_weeks: null,
        priority_muscles: [], name: '',
      }
    })

    function toggleMuscle(muscle) {
      const idx = state.form.priority_muscles.indexOf(muscle)
      if (idx >= 0) state.form.priority_muscles.splice(idx, 1)
      else state.form.priority_muscles.push(muscle)
    }

    async function generate() {
      state.generating = true
      try {
        const program = await api.generate({
          ...state.form,
          days_per_week: parseInt(state.form.days_per_week),
          duration_weeks: state.form.duration_weeks
            ? parseInt(state.form.duration_weeks) : null,
        })
        store.showToast(t('programs.generated'), 'success')
        router.push('#/programs/' + program.id)
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        state.generating = false
      }
    }

    return { state, generate, toggleMuscle, router, t, GOALS, LEVELS, MUSCLES }
  },

  template: `
    <div class="view">
      <PageHeader :title="t('programs.generator_title')" :show-back="true" />
      <div class="view__content" style="padding:0 1rem">
        <form @submit.prevent="generate">
          <div class="form-group">
            <label class="form-label">{{ t('programs.form_name_optional') }}</label>
            <input class="form-input" v-model="state.form.name"
              :placeholder="t('programs.form_name_placeholder')" />
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
            <label class="form-label">{{ t('programs.generator_muscles') }}</label>
            <div class="muscle-chips">
              <button
                v-for="m in MUSCLES" :key="m" type="button"
                class="chip"
                :class="{ 'chip--active': state.form.priority_muscles.includes(m) }"
                @click="toggleMuscle(m)">
                {{ t('muscles.' + m) }}
              </button>
            </div>
          </div>
          <button type="submit" class="btn btn--primary btn--full"
            :disabled="state.generating" style="margin-top:1rem">
            {{ state.generating ? t('programs.generating') : t('programs.generator_btn') }}
          </button>
        </form>
      </div>
    </div>
  `
}
