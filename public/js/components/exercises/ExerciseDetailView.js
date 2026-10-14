import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { exercises as api } from '../../api.js'
import { estimate1RM, rmTable } from '../../utils/rm.js'
import { t, tm } from '../../i18n.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'

export default {
  name: 'ExerciseDetailView',
  props: { id: { type: String, required: true } },
  components: { PageHeader, LoadingSpinner, ErrorBanner },

  setup(props) {
    const router = inject('router')
    const store  = inject('store')

    const state = reactive({
      loading: false, error: null,
      exercise: null, history: [],
      imageIndex: 0,
    })

    async function load() {
      state.loading = true; state.error = null
      try {
        const [ex, hist] = await Promise.all([
          api.get(props.id),
          api.history(props.id, { limit: 5 })
        ])
        state.exercise = ex
        state.history  = hist.history
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    onMounted(() => {
      window.scrollTo(0, 0)
      load()
    })

    // RM estimé depuis la dernière performance
    function lastRM() {
      if (!state.history?.length) return null
      const lastSession = state.history[0]
      const bestSet = lastSession.sets.reduce((best, s) =>
        (s.is_completed && s.reps > 0 && s.weight_kg > estimate1RM(best?.weight_kg||0, best?.reps||1))
          ? s : best
      , null)
      if (!bestSet) return null
      const formula = store.getSetting('rm_formula', 'epley')
      return { rm: estimate1RM(bestSet.weight_kg, bestSet.reps, formula), set: bestSet }
    }

    return { state, load, router, t, tm, lastRM }
  },

  template: `
    <div class="view">
      <PageHeader
        :title="state.exercise?.name_fr || '…'"
        :show-back="true"
      >
        <template #actions v-if="state.exercise?.is_custom">
          <button class="btn btn--secondary"
            style="padding:0.4rem 0.75rem;font-size:0.85rem"
            @click="router.push('#/exercises/' + state.exercise.id + '/edit')">
            {{ t('common.edit') }}
          </button>
        </template>
      </PageHeader>

      <div class="view__content" style="padding:0 1rem">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner v-else-if="state.error" :message="state.error" :retry="load" />

        <template v-else-if="state.exercise">
          <!-- Images -->
          <div v-if="state.exercise.image_paths.length" class="exercise-detail__images">
            <img
              :src="'/exercises/images/' + state.exercise.image_paths[state.imageIndex]"
              :alt="state.exercise.name_fr"
              class="exercise-detail__img"
              @error="$event.target.style.display='none'"
            />
            <div v-if="state.exercise.image_paths.length > 1" class="exercise-detail__dots">
              <button
                v-for="(_, i) in state.exercise.image_paths" :key="i"
                class="exercise-detail__dot"
                :aria-label="t('exercises.image_number', { number: i + 1 })"
                :aria-pressed="i === state.imageIndex"
                :class="{ 'exercise-detail__dot--active': i === state.imageIndex }"
                @click="state.imageIndex = i"
              />
            </div>
          </div>

          <!-- Muscles -->
          <section class="detail-section">
            <h3 class="detail-section__title">{{ t('exercises.primary') }}</h3>
            <p>{{ state.exercise.primary_muscles.map(m => tm(m)).join(', ') }}</p>
            <template v-if="state.exercise.secondary_muscles.length">
              <h3 class="detail-section__title" style="margin-top:0.5rem">{{ t('exercises.secondary') }}</h3>
              <p>{{ state.exercise.secondary_muscles.map(m => tm(m)).join(', ') }}</p>
            </template>
          </section>

          <!-- Équipement -->
          <section v-if="state.exercise.equipment_required.length" class="detail-section">
            <h3 class="detail-section__title">{{ t('exercises.equipment') }}</h3>
            <p>{{ state.exercise.equipment_required.map(e => t('equipment.category_' + e)).join(', ') }}</p>
          </section>

          <!-- Instructions -->
          <section v-if="state.exercise.instructions_fr.length" class="detail-section">
            <h3 class="detail-section__title">{{ t('exercises.instructions') }}</h3>
            <ol class="instruction-list">
              <li v-for="(step, i) in state.exercise.instructions_fr" :key="i">{{ step }}</li>
            </ol>
          </section>

          <!-- Dernière performance + RM -->
          <section v-if="lastRM()" class="detail-section">
            <h3 class="detail-section__title">{{ t('stats.rm_estimated') }}</h3>
            <p style="font-size:1.5rem;font-weight:700;color:var(--color-primary)">
              {{ lastRM().rm }} kg
            </p>
            <p style="font-size:0.85rem;color:var(--color-text-muted)">
              {{ t('exercises.performance_basis', { weight: lastRM().set.weight_kg, reps: lastRM().set.reps }) }}
            </p>
          </section>

          <!-- Historique -->
          <section class="detail-section">
            <h3 class="detail-section__title">{{ t('exercises.history') }}</h3>
            <div v-if="!state.history.length" style="color:var(--color-text-muted);font-size:0.9rem">
              {{ t('session.no_history') }}
            </div>
            <div v-for="session in state.history" :key="session.session_id"
              class="history-session">
              <div class="history-session__date">{{ session.scheduled_date }}</div>
              <div class="history-session__sets">
                <span v-for="s in session.sets.filter(s => s.is_completed)" :key="s.set_id"
                  class="history-set">
                  {{ s.weight_kg }}kg × {{ s.reps }}
                </span>
              </div>
            </div>
          </section>
        </template>
      </div>
    </div>
  `
}
