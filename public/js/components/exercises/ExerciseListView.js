import { reactive, onMounted, onBeforeUnmount, nextTick, inject, computed, watch } from '/vendor/vue.esm-browser.prod.js'
import { ALL_MUSCLES } from '../../utils/muscles.js'
import { exercises as api, settings as settingsApi } from '../../api.js'
import { t, tm, exerciseName, i18n } from '../../i18n.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'
import EmptyState     from '../common/EmptyState.js'
import ExerciseFilter from './ExerciseFilter.js'
import EquipmentEditor from '../equipment/EquipmentEditor.js'

const catalogMemory = {filters:{muscle:'',equipment:'',equipment_family:'',available:false,movement:'',q:''},scrollY:0,filtersOpen:false}

export default {
  name: 'ExerciseListView',
  components: { PageHeader, LoadingSpinner, ErrorBanner, EmptyState, ExerciseFilter, EquipmentEditor },

  setup() {
    const router = inject('router')
    const store  = inject('store')

    const state = reactive({
      loading:      false,
      error:        null,
      exercises:    [],
      filters: {...catalogMemory.filters}, filtersOpen:catalogMemory.filtersOpen,
      showExcluded: true,
      activeTab:    router.currentRoute.params.tab || 'list',
      materialVisited: router.currentRoute.params.tab === 'material',
      painfulMuscles: [...(store.settings?.painful_muscles || [])],
      savingPain:false,
    })

    let requestVersion = 0
    let filterTimer = null
    async function load() {
      const version = ++requestVersion
      state.loading = true; state.error = null
      try {
        const params = {}
        if (state.filters.muscle)    params.muscle    = state.filters.muscle
        if (state.filters.equipment) params.equipment = state.filters.equipment
        if (state.filters.movement)  params.movement  = state.filters.movement
        if (state.filters.q)         params.q         = state.filters.q
        if (state.filters.equipment_family) params.equipment_family = state.filters.equipment_family
        if (state.filters.available) params.available = '1'
        const data = await api.list(params)
        if (version === requestVersion) state.exercises = data.exercises
      } catch (err) { if (version === requestVersion) state.error = err.message }
      finally { if (version === requestVersion) state.loading = false }
    }

    function onFilterChange(f) {
      const searchChanged = f.q !== state.filters.q
      ++requestVersion
      clearTimeout(filterTimer)
      Object.assign(state.filters, f)
      catalogMemory.filters = {...f}
      if (searchChanged && f.q) filterTimer = setTimeout(load, 150)
      else load()
    }

    function selectTab(tab) {
      router.push(tab === 'list' ? '#/exercises' : '#/exercises/' + tab)
    }
    watch(() => router.currentRoute.params.tab, tab => {
      state.activeTab = tab || 'list'
      if (state.activeTab === 'material') state.materialVisited = true
      if (state.activeTab === 'list') load()
    })

    const byName = (a, b) =>
      exerciseName(a).localeCompare(exerciseName(b), i18n.locale)

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

    async function togglePain(muscle) {
      if (state.savingPain) return
      const before=[...state.painfulMuscles]
      state.painfulMuscles=before.includes(muscle) ? before.filter(m=>m!==muscle) : [...before,muscle]
      state.savingPain=true
      try {
        const saved=await settingsApi.update({painful_muscles:state.painfulMuscles})
        store.setSettings(saved)
      } catch (err) {
        state.painfulMuscles=before
        store.showToast(err.message,'error')
      } finally {state.savingPain=false}
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
      if (router.previousRoute?.name === 'ExerciseDetailView' || router.previousRoute?.name === 'ExerciseEditView') {
        await new Promise(requestAnimationFrame)
        window.scrollTo(0,catalogMemory.scrollY)
      }
    })

    onBeforeUnmount(() => {
      ++requestVersion
      clearTimeout(filterTimer)
      catalogMemory.filters = {...state.filters}
      catalogMemory.filtersOpen = state.filtersOpen
      catalogMemory.scrollY = router.previousScrollY
    })

    return {
      state, displayedExercises, excludedExercises, excludedCount,
      painFilteredCount, ALL_MUSCLES,
      load, selectTab, onFilterChange, toggleExclusion, togglePain, usesPainfulMuscle,
      router, t, tm, exerciseName,
    }
  },

  template: `
    <div class="view">
      <PageHeader :title="t('exercises.title')" />

      <!-- Onglets -->
      <div class="exercise-tabs">
        <button class="exercise-tabs__btn"
          :class="{ 'exercise-tabs__btn--active': state.activeTab === 'list' }"
          @click="selectTab('list')">
          {{ t('exercises.tab_list') }}
          <span v-if="excludedCount" class="exercise-tabs__exclusions" :aria-label="t('exercises.excluded_count', {count:excludedCount})">🚫 {{ excludedCount }}</span>
          <span class="exercise-tabs__badge" :aria-label="t('exercises.remaining_count', {count:displayedExercises.length})">{{ displayedExercises.length }}</span>
        </button>
        <button class="exercise-tabs__btn"
          :class="{ 'exercise-tabs__btn--active': state.activeTab === 'pain' }"
          @click="selectTab('pain')">
          {{ t('exercises.tab_pain') }}
          <span v-if="state.painfulMuscles.length" class="exercise-tabs__badge exercise-tabs__badge--active">{{ state.painfulMuscles.length }}</span>
        </button>
        <button class="exercise-tabs__btn"
          :class="{ 'exercise-tabs__btn--active': state.activeTab === 'material' }"
          @click="selectTab('material')">{{ t('exercises.tab_material') }}</button>
      </div>

      <div class="view__content">
        <div v-if="state.materialVisited" v-show="state.activeTab === 'material'" class="exercise-material-panel">
          <EquipmentEditor />
        </div>
        <!-- ═══ Onglet Exercices ═══ -->
        <template v-if="state.activeTab === 'list'">
          <ExerciseFilter :filters="state.filters" :expanded="state.filtersOpen" @toggle="state.filtersOpen=$event" @change="onFilterChange" />

          <div v-if="painFilteredCount > 0" class="exercise-pain-bar">
            <span>🤕 {{ t('exercises.pain_filtered', { count: painFilteredCount }) }}</span>
            <button class="exercise-pain-bar__btn" @click="selectTab('pain')">
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
                <span class="exercise-card__name">{{ exerciseName(ex) }}</span>
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
                <span class="exercise-card__name">{{ exerciseName(ex) }}</span>
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
                  @click.stop="toggleExclusion(ex, $event)" :aria-label="t('exercises.exclude_btn')">
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
                  :disabled="state.savingPain"
                  @change="togglePain(m)" />
                <span>{{ tm(m) }}</span>
              </label>
            </div>

            <div v-if="state.painfulMuscles.length" class="pain-summary">
              <p>🤕 {{ t('exercises.pain_filtered', { count: painFilteredCount }) }}</p>
              <button class="btn btn--secondary" @click="selectTab('list')">
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
