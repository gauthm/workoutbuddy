import { reactive, onMounted, onBeforeUnmount, nextTick, inject, computed } from '/vendor/vue.esm-browser.prod.js'
import { exercises as api } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'
import EmptyState     from '../common/EmptyState.js'
import ExerciseFilter from './ExerciseFilter.js'

// Position de scroll mémorisée par route (survie au remontage SPA)
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
    })

    // ── Chargement ────────────────────────────────────────────
    async function load() {
      state.loading = true; state.error = null
      try {
        // Charger TOUS les exercices (exclus inclus) pour le toggle
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

    // ── Tri alphabétique ───────────────────────────────────────
    const byName = (a, b) =>
      (a.name_fr || a.name_en || '').localeCompare(b.name_fr || b.name_en || '', 'fr')

    const displayedExercises = computed(() =>
      state.exercises.filter(e => !e.is_excluded).sort(byName)
    )

    const excludedExercises = computed(() =>
      state.exercises.filter(e => e.is_excluded).sort(byName)
    )

    const excludedCount = computed(() => state.exercises.filter(e => e.is_excluded).length)

    // ── Toggle exclusion ──────────────────────────────────────
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
      // Mémoriser seulement quand on ouvre le détail d'un exo (retour = même position)
      const h = window.location.hash
      const keep = h.startsWith('#/exercises/') && h !== '#/exercises'
      scrollMemory.set(SCROLL_KEY, keep ? window.scrollY : 0)
    })

    return {
      state, displayedExercises, excludedExercises, excludedCount,
      load, onFilterChange, toggleExclusion, router, t,
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

      <div class="view__content">
        <ExerciseFilter :filters="state.filters" @change="onFilterChange" />

        <!-- Bandeau exercices exclus -->
        <div v-if="excludedCount > 0" class="exercise-excluded-bar">
          <span class="exercise-excluded-bar__count">
            🚫 {{ t('exercises.excluded_count', { count: excludedCount }) }}
          </span>
          <button class="exercise-excluded-bar__toggle"
            @click="state.showExcluded = !state.showExcluded">
            {{ state.showExcluded ? t('exercises.hide_excluded') : t('exercises.show_excluded') }}
          </button>
        </div>

        <!-- Section désactivés : affichés à la suite sous le bandeau -->
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
                {{ (ex.primary_muscles || []).map(m => t('muscles.' + m) || m).join(', ') }}
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
                {{ (ex.primary_muscles || []).map(m => t('muscles.' + m) || m).join(', ') }}
              </span>

              <!-- Bouton désactivation -->
              <button
                class="exercise-card__exclude-btn"
                :title="t('exercises.exclude_btn')"
                @click.stop="toggleExclusion(ex, $event)">
                🚫
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}
