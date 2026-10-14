import ModalDialog from '../common/ModalDialog.js'
import { reactive, onMounted, computed, inject } from '/vendor/vue.esm-browser.prod.js'
import { sessions as api } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader    from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner   from '../common/ErrorBanner.js'
import ConfirmModal  from '../common/ConfirmModal.js'
import { isoDate } from '../../utils/date.js'

// ── Helpers date ──────────────────────────────────────────────────────────

// Retourne le lundi de la semaine contenant la date
function mondayOf(date) {
  const d = new Date(date)
  const day = d.getDay()  // 0=dimanche
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

// Retourne toutes les cellules de la grille pour un mois donné
// (peut inclure des jours du mois précédent/suivant pour compléter les semaines)
function buildGrid(year, month) {
  // month : 0-indexé (0=janvier)
  const firstDay  = new Date(year, month, 1)
  const startDate = mondayOf(firstDay)

  const cells = []
  const current = new Date(startDate)

  // Générer jusqu'à 6 semaines × 7 jours = 42 cellules max
  while (cells.length < 42) {
    cells.push({
      date:         isoDate(current),
      day:          current.getDate(),
      isCurrentMonth: current.getMonth() === month,
      isToday:      isoDate(current) === isoDate(new Date()),
    })
    current.setDate(current.getDate() + 1)
    // Arrêter si on a passé le premier jour du mois suivant :
    // compléter la semaine en cours puis sortir
    if (current.getDate() === 1 && current.getMonth() !== month) {
      // Compléter la semaine en cours
      while (current.getDay() !== 1) {
        cells.push({
          date:           isoDate(current),
          day:            current.getDate(),
          isCurrentMonth: false,
          isToday:        false,
        })
        current.setDate(current.getDate() + 1)
      }
      break
    }
  }

  return cells
}

const MONTH_NAMES_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
]
const MONTH_NAMES_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]
const DAY_HEADERS_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
const DAY_HEADERS_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// Couleur des points par statut
const STATUS_COLORS = {
  completed:   'var(--color-success)',
  in_progress: 'var(--color-info)',
  planned:     'var(--color-warning)',
  skipped:     'var(--color-border)',
}

export default {
  name: 'CalendarView',
  components: { ModalDialog, PageHeader, LoadingSpinner, ErrorBanner, ConfirmModal },

  props: {embedded: {type:Boolean,default:false}},

  setup(props) {
    const router  = inject('router')
    const store   = inject('store')
    const today   = new Date()

    const state = reactive({
      year:    today.getFullYear(),
      month:   today.getMonth(),  // 0-indexé
      loading: false,
      error:   null,
      sessions: [],               // Session[] du mois courant

      // Popup jour sélectionné
      selectedDate:     props.embedded ? isoDate(today) : null,
      selectedSessions: [],

      // Modale replanification
      showReschedule:   false,
      rescheduleSession: null,
      newDate:          '',

      // Modale confirmation skip
      showSkip:         false,
      skipSession:      null,
    })

    // ── Grille ────────────────────────────────────────────────────
    const grid = computed(() => buildGrid(state.year, state.month))

    const monthLabel = computed(() => {
      const lang = store.getSetting('language', 'fr')
      const names = lang === 'fr' ? MONTH_NAMES_FR : MONTH_NAMES_EN
      return `${names[state.month]} ${state.year}`
    })

    const dayHeaders = computed(() => {
      const lang = store.getSetting('language', 'fr')
      return lang === 'fr' ? DAY_HEADERS_FR : DAY_HEADERS_EN
    })

    // Map date → sessions pour un accès O(1)
    const sessionsByDate = computed(() => {
      const map = {}
      for (const s of state.sessions) {
        if (!map[s.scheduled_date]) map[s.scheduled_date] = []
        map[s.scheduled_date].push(s)
      }
      return map
    })

    // ── Chargement ────────────────────────────────────────────────
    let loadRevision=0
    async function load() {
      const revision=++loadRevision
      state.loading = true
      state.error   = null
      state.sessions = []

      // Charger le mois courant + un peu de marge (jours du mois adjacent visibles)
      const from = isoDate(new Date(state.year, state.month - 1, 20))
      const to   = isoDate(new Date(state.year, state.month + 1, 10))

      try {
        const data = await api.list({ from, to, limit: 200, calendar: 1 })
        if(revision!==loadRevision)return
        state.sessions = data.sessions
        state.selectedSessions=state.selectedDate ? data.sessions.filter(s=>s.scheduled_date===state.selectedDate) : []
      } catch (err) {
        if(revision===loadRevision)state.error = err.message
      } finally {
        if(revision===loadRevision)state.loading = false
      }
    }

    // ── Navigation ────────────────────────────────────────────────
    function prevMonth() {
      if (state.month === 0) { state.year--; state.month = 11 }
      else state.month--
      state.selectedDate = null
      load()
    }

    function nextMonth() {
      if (state.month === 11) { state.year++; state.month = 0 }
      else state.month++
      state.selectedDate = null
      load()
    }

    // ── Sélection d'un jour ───────────────────────────────────────
    function selectDay(cell) {
      if (state.selectedDate === cell.date) {
        state.selectedDate = null
        return
      }
      state.selectedDate     = cell.date
      state.selectedSessions = sessionsByDate.value[cell.date] || []
    }

    // ── Actions séance ────────────────────────────────────────────
    async function startSession(session) {
      try {
        const startRes = await api.start(session.id)
        store.setActiveSession(startRes)
        store.setPendingAdjustments(startRes.adjustments || [])
        router.push('#/session')
      } catch (err) {
        store.showToast(err.message, 'error')
      }
    }

    function openReschedule(session) {
      state.rescheduleSession = session
      state.newDate           = session.scheduled_date
      state.showReschedule    = true
    }

    async function doReschedule() {
      if (!state.newDate || !state.rescheduleSession) return
      try {
        await api.update(state.rescheduleSession.id, { scheduled_date: state.newDate })
        store.showToast(t('calendar.rescheduled_toast'), 'success')
        state.showReschedule    = false
        state.rescheduleSession = null
        state.selectedDate      = null
        await load()
      } catch (err) {
        store.showToast(err.message, 'error')
      }
    }

    function openSkip(session) {
      state.skipSession = session
      state.showSkip    = true
    }

    async function doSkip() {
      if (!state.skipSession) return
      try {
        await api.skip(state.skipSession.id)
        store.showToast(t('calendar.skipped_toast'), 'info')
        state.showSkip    = false
        state.skipSession = null
        state.selectedDate = null
        await load()
      } catch (err) {
        store.showToast(err.message, 'error')
      }
    }

    function viewSession(session) {
      router.push('#/session/' + session.id)
    }

    onMounted(load)

    return {
      state, grid, monthLabel, dayHeaders,
      sessionsByDate, STATUS_COLORS,
      prevMonth, nextMonth, selectDay,
      startSession, openReschedule, doReschedule,
      openSkip, doSkip, viewSession,
      load, router, t,
    }
  },

  template: `
    <section :class="embedded ? 'calendar-embedded' : 'view'" :aria-label="t('calendar.title')">
      <PageHeader v-if="!embedded" :title="t('calendar.title')" />
      <h2 v-else class="dashboard-section__title">{{t('calendar.title')}}</h2>

      <div :class="embedded ? 'calendar-embedded__content' : 'view__content'">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner   v-else-if="state.error" :message="state.error" :retry="load" />

        <template v-else>
          <!-- Navigation mois -->
          <div class="calendar-nav">
            <button class="calendar-nav__btn" :aria-label="t('calendar.previous_month')" @click="prevMonth()">‹</button>
            <span class="calendar-nav__label">{{ monthLabel }}</span>
            <button class="calendar-nav__btn" :aria-label="t('calendar.next_month')" @click="nextMonth()">›</button>
          </div>

          <!-- En-têtes jours -->
          <div class="calendar-grid">
            <div
              v-for="h in dayHeaders" :key="h"
              class="calendar-grid__header">
              {{ h }}
            </div>

            <!-- Cellules -->
            <button
              v-for="cell in grid" :key="cell.date"
              class="calendar-cell"
              :aria-label="cell.date"
              :aria-pressed="state.selectedDate === cell.date"
              :class="{
                'calendar-cell--other-month': !cell.isCurrentMonth,
                'calendar-cell--today':        cell.isToday,
                'calendar-cell--selected':     state.selectedDate === cell.date,
                'calendar-cell--has-session':  !!sessionsByDate[cell.date],
              }"
              @click="selectDay(cell)">

              <span class="calendar-cell__day">{{ cell.day }}</span>

              <!-- Points de statut -->
              <div class="calendar-cell__dots">
                <span
                  v-for="s in (sessionsByDate[cell.date] || [])"
                  :key="s.id"
                  class="calendar-cell__dot"
                  :style="{ background: STATUS_COLORS[s.status] || STATUS_COLORS.planned }"
                />
              </div>
            </button>
          </div>

          <!-- Légende -->
          <div class="calendar-legend">
            <span v-for="(color, status) in STATUS_COLORS" :key="status"
              class="calendar-legend__item">
              <span class="calendar-cell__dot" :style="{ background: color }" />
              {{ t('calendar.' + status) }}
            </span>
          </div>

          <!-- Panneau jour sélectionné -->
          <div v-if="state.selectedDate" class="calendar-day-panel">
            <div class="calendar-day-panel__date">{{ state.selectedDate }}</div>

            <div v-if="!state.selectedSessions.length"
              style="color:var(--color-text-muted);font-size:0.9rem;padding:0.5rem 0">
              {{ t('calendar.no_session') }}
            </div>

            <div
              v-for="session in state.selectedSessions"
              :key="session.id"
              class="calendar-day-session">
              <div class="calendar-day-session__name">{{ session.name }}</div>
              <div class="calendar-day-session__status"
                :style="{ color: STATUS_COLORS[session.status] }">
                {{ t('calendar.' + session.status) }}
              </div>

              <!-- Actions selon statut -->
              <div class="calendar-day-session__actions">
                <template v-if="session.status === 'completed'">
                  <button class="btn btn--secondary"
                    style="padding:0.3rem 0.75rem;font-size:0.8rem"
                    @click="viewSession(session)">
                    {{ t('calendar.view') }}
                  </button>
                </template>

                <template v-if="session.status === 'in_progress'">
                  <button class="btn btn--primary"
                    style="padding:0.3rem 0.75rem;font-size:0.8rem"
                    @click="router.push('#/session')">
                    {{ t('calendar.resume') }}
                  </button>
                </template>

                <template v-if="session.status === 'planned'">
                  <button class="btn btn--primary"
                    style="padding:0.3rem 0.75rem;font-size:0.8rem"
                    @click="startSession(session)">
                    {{ t('calendar.start') }}
                  </button>
                  <button class="btn btn--secondary"
                    style="padding:0.3rem 0.75rem;font-size:0.8rem"
                    @click="openReschedule(session)">
                    {{ t('calendar.reschedule') }}
                  </button>
                  <button class="btn btn--secondary"
                    style="padding:0.3rem 0.75rem;font-size:0.8rem;color:var(--color-text-muted)"
                    @click="openSkip(session)">
                    {{ t('calendar.mark_skipped') }}
                  </button>
                </template>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Modale replanification -->
      <ModalDialog v-if="state.showReschedule" :title="t('calendar.reschedule_title')" @close="state.showReschedule = false">
          <div class="form-group">
            <label class="form-label" for="CalendarView-state-newDate">{{ t('calendar.reschedule_date') }}</label>
            <input id="CalendarView-state-newDate" class="form-input" type="date" v-model="state.newDate" />
          </div>
          <div class="modal__actions">
            <button class="btn btn--secondary" @click="state.showReschedule=false">
              {{ t('common.cancel') }}
            </button>
            <button class="btn btn--primary" @click="doReschedule()">
              {{ t('common.confirm') }}
            </button>
          </div>

      </ModalDialog>

      <!-- Modale skip -->
      <ConfirmModal
        v-if="state.showSkip"
        :title="t('calendar.mark_skipped')"
        :body="state.skipSession?.name"
        @confirm="doSkip()"
        @cancel="state.showSkip = false"
      />
    </section>
  `
}
