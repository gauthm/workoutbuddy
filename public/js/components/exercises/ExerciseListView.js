import { reactive, onMounted, onBeforeUnmount, nextTick, inject, computed } from '/vendor/vue.esm-browser.prod.js'
import { exercises as api } from '../../api.js'
import { t, tm } from '../../i18n.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'
import EmptyState     from '../common/EmptyState.js'
import ExerciseFilter from './ExerciseFilter.js'

const ALL_MUSCLES = [
  'chest','back','shoulders','biceps','triceps',
  'quads','hamstrings','glutes','calves','core','traps','forearms',
  'lower_back','inner_thigh','neck'
]

const PAIN_KEY = 'wb_painful_muscles'

function loadPain() {
  try { return JSON.parse(localStorage.getItem(PAIN_KEY) || '[]') } catch { return [] }
}
function savePain(arr) {
  localStorage.setItem(PAIN_KEY, JSON.stringify(arr))
}

const scrollMemory = new Map()
const SCROLL_KEY = '#/exercises'

export default {
  name: 'ExerciseListView',
  components: { PageHeader, LoadingSpinner, ErrorBanner, EmptyState, ExerciseFilter },

  setup() {
    const router = inject('router')
    const store  = inject('store')

    const state = reactive({
      loading:      false,
      error:        null,
      exercises:    [],
      filters:      { muscle: '', equipment: '', movement: '', q: '' },
      showExcluded: true,
      activeTab:    'list',
      painfulMuscles: loadPain(),
    })

    async function load() {
      state.loading = true; state.error = null
      try {
        const params = {}
        if (state.filters.muscle)    params.muscle    = state.filters.muscle
        if (state.filters.equipment) params.equipment = state.filters.equipment
        if (state.filters.movement)  params.movement  = state.filters.movement
        if (state.filters.q)         params.q         = state.filters.q
        const data = await api.list(params)
        state.exercises = data.exercises
      } catch (err) { state.error = err.message }
      finally { state.loading = false }
    }

    function onFilterChange(f) { Object.assign(state.filters, f); load() }

    const byName = (a, b) =>
      (a.name_fr || a.name_en || '').localeCompare(b.name_fr || b.name_en || '', 'fr')

    function usesPainfulMuscle(ex) {
      if (!state.painfulMuscles.length) return false
      const all = [...(ex.primary_muscles||[]), ...(ex.secondary_muscles||[])]
      return all.some(m => state.painfulMuscles.includes(m))
    }

    const displayedExercises = computed(() =>
      state.exercises
        .filter(e => !e.is_excluded)
        .filter(e => !usesPainfulMuscle(e))
        .sort(byName)
    )

    const excludedExercises = computed(() =>
      state.exercises.filter(e => e.is_excluded).sort(byName)
    )

    const excludedCount = computed(() => state.exercises.filter(e => e.is_excluded).length)

    const painFilteredCount = computed(() =>
      state.exercises.filter(e => !e.is_excluded && usesPainfulMuscle(e)).length
    )

    function togglePain(muscle) {
      const idx = state.painfulMuscles.indexOf(muscle)
      if (idx === -1) state.painfulMuscles.push(muscle)
      else state.painfulMuscles.splice(idx, 1)
      savePain(state.painfulMuscles)
    }

    async function toggleExclusion(ex, event) {
      event.stopPropagation()
      try {
        const updated = await api.toggleExclusion(ex.id, { is_excluded: !ex.is_excluded })
        const idx = state.exercises.findIndex(e => e.id === ex.id)
        if (idx !== -1) {
          state.exercises[idx] = {
            ...state.exercises[idx],
            is_excluded:      updated.is_excluded,
            exclusion_reason: updated.exclusion_reason,
          }
        }
        store.showToast(
          updated.is_excluded
            ? t('exercises.excluded_toast')
            : t('exercises.included_toast'),
          updated.is_excluded ? 'info' : 'success'
        )
      } catch (err) {
        store.showToast(err.message, 'error')
      }
    }

    onMounted(async () => {
      await load()
      await nextTick()
      const saved = scrollMemory.get(SCROLL_KEY)
      if (saved) window.scrollTo(0, saved)
    })

    onBeforeUnmount(() => {
      const h = window.location.hash
      const keep = h.startsWith('#/exercises/') && h !== '#/exercises'
      scrollMemory.set(SCROLL_KEY, keep ? window.scrollY : 0)
    })

    return {
      state, displayedExercises, excludedExercises, excludedCount,
      painFilteredCount, ALL_MUSCLES,
      load, onFilterChange, toggleExclusion, togglePain, usesPainfulMuscle,
      router, t, tm,
    }
  },

  template: `
    <div class="view">
      <PageHeader :title="t('exercises.title')">
        <template #actions>
          <button class="btn btn--primary"
            style="padding:0.4rem 0.75rem;font-size:0.85rem"
            @click="router.push('#/exercises/new')">+</button>
        </template>
      </PageHeader>

      <!-- Onglets -->
      <div class="exercise-tabs">
        <button class="exercise-tabs__btn"
          :class="{ 'exercise-tabs__btn--active': state.activeTab === 'list' }"
          @click="state.activeTab = 'list'">
          {{ t('exercises.tab_list') }}
          <span v-if="painFilteredCount > 0" class="exercise-tabs__badge">{{ painFilteredCount }}</span>
        </button>
        <button class="exercise-tabs__btn"
          :class="{ 'exercise-tabs__btn--active': state.activeTab === 'pain' }"
          @click="state.activeTab = 'pain'">
          {{ t('exercises.tab_pain') }}
          <span v-if="state.painfulMuscles.length" class="exercise-tabs__badge exercise-tabs__badge--active">{{ state.painfulMuscles.length }}</span>
        </button>
      </div>

      <div class="view__content">
        <!-- ═══ Onglet Exercices ═══ -->
        <template v-if="state.activeTab === 'list'">
          <ExerciseFilter :filters="state.filters" @change="onFilterChange" />

          <div v-if="painFilteredCount > 0" class="exercise-pain-bar">
            <span>🤕 {{ t('exercises.pain_filtered', { count: painFilteredCount }) }}</span>
            <button class="exercise-pain-bar__btn" @click="state.activeTab = 'pain'">
              {{ t('exercises.tab_pain') }}
            </button>
          </div>

          <div v-if="excludedCount > 0" class="exercise-excluded-bar">
            <span class="exercise-excluded-bar__count">
              🚫 {{ t('exercises.excluded_count', { count: excludedCount }) }}
            </span>
            <button class="exercise-excluded-bar__toggle"
              @click="state.showExcluded = !state.showExcluded">
              {{ state.showExcluded ? t('exercises.hide_excluded') : t('exercises.show_excluded') }}
            </button>
          </div>

          <div v-if="excludedCount > 0 && state.showExcluded" class="exercise-list exercise-list--excluded">
            <div
              v-for="ex in excludedExercises"
              :key="ex.id"
              class="exercise-card exercise-card--excluded"
              @click="router.push('#/exercises/' + ex.id)">

              <div class="exercise-card__main">
                <span class="exercise-card__name">{{ ex.name_fr || ex.name_en }}</span>
                <div style="display:flex;gap:0.3rem;align-items:center;flex-shrink:0">
                  <span v-if="ex.is_custom" class="badge badge--custom">{{ t('exercises.custom_badge') }}</span>
                  <span class="badge badge--excluded">{{ t('exercises.excluded_badge') }}</span>
                </div>
              </div>

              <div class="exercise-card__meta">
                <span class="exercise-card__muscles">
                  {{ (ex.primary_muscles || []).map(m => tm(m)).join(', ') }}
                </span>
                <button class="btn btn--secondary exercise-card__reactivate"
                  @click.stop="toggleExclusion(ex, $event)">
                  ↩️ {{ t('exercises.include_btn') }}
                </button>
              </div>

              <div v-if="ex.exclusion_reason" class="exercise-card__exclusion-reason">
                {{ t('exercises.exclusion_reason', { reason: ex.exclusion_reason }) }}
              </div>
            </div>
          </div>

          <LoadingSpinner v-if="state.loading" />
          <ErrorBanner   v-else-if="state.error" :message="state.error" :retry="load" />
          <EmptyState    v-else-if="!displayedExercises.length"
            icon="🔍" :message="t('exercises.no_results')" />

          <div v-else class="exercise-list">
            <div
              v-for="ex in displayedExercises"
              :key="ex.id"
              class="exercise-card"
              @click="router.push('#/exercises/' + ex.id)">

              <div class="exercise-card__main">
                <span class="exercise-card__name">{{ ex.name_fr || ex.name_en }}</span>
                <div style="display:flex;gap:0.3rem;align-items:center;flex-shrink:0">
                  <span v-if="ex.is_custom" class="badge badge--custom">{{ t('exercises.custom_badge') }}</span>
                </div>
              </div>

              <div class="exercise-card__meta">
                <span class="exercise-card__muscles">
                  {{ (ex.primary_muscles || []).map(m => tm(m)).join(', ') }}
                </span>

                <button
                  class="exercise-card__exclude-btn"
                  :title="t('exercises.exclude_btn')"
                  @click.stop="toggleExclusion(ex, $event)">
                  🚫
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- ═══ Onglet Douleurs ═══ -->
        <template v-if="state.activeTab === 'pain'">
          <div class="pain-section">
            <p class="pain-section__hint">{{ t('exercises.pain_hint') }}</p>

            <div class="pain-grid">
              <label
                v-for="m in ALL_MUSCLES" :key="m"
                class="pain-chip"
                :class="{ 'pain-chip--active': state.painfulMuscles.includes(m) }">
                <input type="checkbox"
                  :checked="state.painfulMuscles.includes(m)"
                  @change="togglePain(m)" />
                <span>{{ tm(m) }}</span>
              </label>
            </div>

            <div v-if="state.painfulMuscles.length" class="pain-summary">
              <p>🤕 {{ t('exercises.pain_filtered', { count: painFilteredCount }) }}</p>
              <button class="btn btn--secondary" @click="state.activeTab = 'list'">
                {{ t('exercises.tab_list') }}
              </button>
            </div>
            <p v-else class="pain-empty">{{ t('exercises.pain_none') }}</p>
          </div>
        </template>
      </div>
    </div>
  `
}
