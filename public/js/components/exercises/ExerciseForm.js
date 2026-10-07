import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { exercises as api } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader    from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner   from '../common/ErrorBanner.js'

const MUSCLES = ['chest','back','shoulders','biceps','triceps',
  'quads','hamstrings','glutes','calves','core','traps','forearms','lower_back']
const MOVEMENTS = [
  'push_horizontal','push_vertical','pull_horizontal','pull_vertical',
  'squat','hinge','lunge','carry','core','rotation','other'
]

export default {
  name: 'ExerciseForm',
  // Prop id : présente si édition, absente si création
  props: { id: { type: String, default: null } },
  components: { PageHeader, LoadingSpinner, ErrorBanner },

  setup(props) {
    const router = inject('router')
    const store  = inject('store')

    const isEdit = !!props.id
    const state = reactive({
      loading: isEdit, error: null, saving: false,
      form: {
        name_fr: '', name_en: '', category: 'strength',
        movement_pattern: 'other', force: '', mechanic: '',
        primary_muscles: [], secondary_muscles: [],
        equipment_required: [], instructions_fr: [], instructions_en: [],
        is_unilateral: false,
      }
    })

    async function load() {
      if (!isEdit) return
      try {
        const ex = await api.get(props.id)
        if (!ex.is_custom) {
          state.error = 'Impossible de modifier un exercice intégré.'
          return
        }
        Object.assign(state.form, {
          name_fr: ex.name_fr, name_en: ex.name_en,
          category: ex.category, movement_pattern: ex.movement_pattern,
          force: ex.force || '', mechanic: ex.mechanic || '',
          primary_muscles: [...ex.primary_muscles],
          secondary_muscles: [...ex.secondary_muscles],
          equipment_required: [...ex.equipment_required],
          is_unilateral: ex.is_unilateral,
        })
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    function toggleMuscle(list, muscle) {
      const idx = list.indexOf(muscle)
      if (idx >= 0) list.splice(idx, 1)
      else list.push(muscle)
    }

    async function save() {
      if (!state.form.name_fr.trim()) {
        store.showToast('Le nom français est obligatoire.', 'error')
        return
      }
      if (!state.form.primary_muscles.length) {
        store.showToast('Choisir au moins un muscle primaire.', 'error')
        return
      }
      state.saving = true
      try {
        if (isEdit) {
          await api.update(props.id, state.form)
          store.showToast('Exercice modifié.', 'success')
        } else {
          await api.create(state.form)
          store.showToast('Exercice créé.', 'success')
        }
        router.back()
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        state.saving = false
      }
    }

    onMounted(load)
    return { state, save, toggleMuscle, isEdit, router, t, MUSCLES, MOVEMENTS }
  },

  template: `
    <div class="view">
      <PageHeader
        :title="isEdit ? t('exercises.edit_title') : t('exercises.new_title')"
        :show-back="true"
      />
      <div class="view__content" style="padding:0 1rem">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner v-else-if="state.error" :message="state.error" />

        <form v-else @submit.prevent="save" class="exercise-form">
          <div class="form-group">
            <label class="form-label">Nom (français) *</label>
            <input class="form-input" v-model="state.form.name_fr" required />
          </div>
          <div class="form-group">
            <label class="form-label">Nom (anglais)</label>
            <input class="form-input" v-model="state.form.name_en" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('exercises.filter_movement') }}</label>
            <select class="form-select" v-model="state.form.movement_pattern">
              <option v-for="mv in MOVEMENTS" :key="mv" :value="mv">
                {{ t('movement.' + mv) }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('exercises.primary') }} *</label>
            <div class="muscle-chips">
              <button
                v-for="m in MUSCLES" :key="m" type="button"
                class="chip"
                :class="{ 'chip--active': state.form.primary_muscles.includes(m) }"
                @click="toggleMuscle(state.form.primary_muscles, m)"
              >{{ t('muscles.' + m) }}</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('exercises.secondary') }}</label>
            <div class="muscle-chips">
              <button
                v-for="m in MUSCLES" :key="m" type="button"
                class="chip"
                :class="{ 'chip--active': state.form.secondary_muscles.includes(m) }"
                @click="toggleMuscle(state.form.secondary_muscles, m)"
              >{{ t('muscles.' + m) }}</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" v-model="state.form.is_unilateral" />
              Exercice unilatéral (un bras / une jambe)
            </label>
          </div>
          <button type="submit" class="btn btn--primary btn--full" :disabled="state.saving">
            {{ state.saving ? t('common.loading') : t('common.save') }}
          </button>
        </form>
      </div>
    </div>
  `
}
