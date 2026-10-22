import ModalDialog from '../common/ModalDialog.js'
import { reactive, onMounted, computed, inject } from '/vendor/vue.esm-browser.prod.js'
import { sessions as api } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader    from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner   from '../common/ErrorBanner.js'
import ConfirmModal  from '../common/ConfirmModal.js'
import { isoDate } from '../../utils/date.js'

// ── Date helpers ──────────────────────────────────────────────────────────

// Return the Monday of the week containing the date
function mondayOf(date) {
  const d = new Date(date)
  const day = d.getDay()  // 0=Sunday
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

// Return every grid cell for the given month
// (may include previous/next month days to complete weeks)
function buildGrid(year, month) {
  // month: zero-based (0=January)
  const firstDay  = new Date(year, month, 1)
  const startDate = mondayOf(firstDay)

  const cells = []
  const current = new Date(startDate)

  // Generate up to 6 weeks × 7 days = 42 cells maximum
  while (cells.length < 42) {
    cells.push({
      date:         isoDate(current),
      day:          current.getDate(),
      isCurrentMonth: current.getMonth() === month,
      isToday:      isoDate(current) === isoDate(new Date()),
    })
    current.setDate(current.getDate() + 1)
    // Stop after passing the first day of the next month:
    // complete the current week, then exit
    if (current.getDate() === 1 && current.getMonth() !== month) {
      // Complete the current week
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


// Dot color by status
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
      month:   today.getMonth(),  // zero-based
      loading: false,
      error:   null,
      sessions: [],               // Session[] for the current month

      // Selected-day popup
      selectedDate:     props.embedded ? isoDate(today) : null,
      selectedSessions: [],
      selectedSessionIndex: 0,

      // Rescheduling dialog
      showReschedule:   false,
      rescheduleSession: null,
      newDate:          '',

      // Skip confirmation dialog
      showSkip:         false,
      skipSession:      null,
      restoringId:      null,
    })

    // ── Grid ────────────────────────────────────────────────────
    const grid = computed(() => buildGrid(state.year, state.month))
    const visibleSessions = computed(() => props.embedded
      ? state.selectedSessions.slice(state.selectedSessionIndex, state.selectedSessionIndex + 1)
      : state.selectedSessions)

    const monthLabel = computed(() => {
      const names = Array.from({ length: 12 }, (_, index) => t('calendar.month_' + index))
      return `${names[state.month]} ${state.year}`
    })

    const dayHeaders = computed(() => {
      return Array.from({ length: 7 }, (_, index) => t('calendar.day_' + index))
    })

    // Map date → sessions for O(1) access
    const sessionsByDate = computed(() => {
      const map = {}
      for (const s of state.sessions) {
        if (!map[s.scheduled_date]) map[s.scheduled_date] = []
        map[s.scheduled_date].push(s)
      }
      return map
    })

    function sessionsForDay(date) {
      const sessions = sessionsByDate.value[date] || []
      if (!props.embedded) return sessions
      const priority = {in_progress:0,planned:1,completed:2,skipped:3}
      return [...sessions].sort((a,b) => priority[a.status] - priority[b.status])
    }

    // ── Loading ────────────────────────────────────────────────
    let loadRevision=0
    async function load() {
      const revision=++loadRevision
      state.loading = true
      state.error   = null
      state.sessions = []

      // Load the current month plus visible days from adjacent months
      const from = isoDate(new Date(state.year, state.month - 1, 20))
      const to   = isoDate(new Date(state.year, state.month + 1, 10))

      try {
        const data = await api.list({ from, to, limit: 200, calendar: 1 })
        if(revision!==loadRevision)return
        state.sessions = data.sessions
        state.selectedSessions=state.selectedDate ? sessionsForDay(state.selectedDate) : []
        state.selectedSessionIndex = 0
      } catch (err) {
        if(revision===loadRevision)state.error = err.message
      } finally {
        if(revision===loadRevision)state.loading = false
      }
    }

    // ── Navigation ────────────────────────────────────────────────
    function selectMonthDefault() {
      const now = new Date()
      state.selectedDate = props.embedded
        ? isoDate(now.getFullYear() === state.year && now.getMonth() === state.month
          ? now : new Date(state.year, state.month, 1))
        : null
      state.selectedSessions = []
      state.selectedSessionIndex = 0
    }

    function prevMonth() {
      if (state.month === 0) { state.year--; state.month = 11 }
      else state.month--
      selectMonthDefault()
      load()
    }

    function nextMonth() {
      if (state.month === 11) { state.year++; state.month = 0 }
      else state.month++
      selectMonthDefault()
      load()
    }

    // ── Day selection ───────────────────────────────────────
    function selectDay(cell) {
      if (state.selectedDate === cell.date) {
        if (props.embedded) return
        state.selectedDate = null
        state.selectedSessions = []
        return
      }
      state.selectedSessionIndex = 0
      state.selectedDate     = cell.date
      state.selectedSessions = sessionsForDay(cell.date)
    }

    // ── Session actions ────────────────────────────────────────────
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
        if (!props.embedded) state.selectedDate = null
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
        if (!props.embedded) state.selectedDate = null
        await load()
      } catch (err) {
        store.showToast(err.message, 'error')
      }
    }

    async function restoreSession(session) {
      if (state.restoringId !== null) return
      state.restoringId=session.id
      try {
        await api.unskip(session.id)
        store.showToast(t('calendar.restored_toast'),'success')
        await load()
      } catch (err) {
        store.showToast(err.message,'error')
      } finally {
        state.restoringId=null
      }
    }

    function viewSession(session) {
      router.push('#/session/' + session.id)
    }

    onMounted(load)

    return {
      state, grid, visibleSessions, monthLabel, dayHeaders,
      sessionsByDate, STATUS_COLORS,
      prevMonth, nextMonth, selectDay,
      startSession, openReschedule, doReschedule,
      openSkip, doSkip, restoreSession, viewSession,
      load, router, t,
    }
  },

  template: `
    <section :class="embedded ? 'calendar-embedded' : 'view'" :aria-label="t('calendar.title')">
      <PageHeader v-if="!embedded" :title="t('calendar.title')" />

      <div :class="embedded ? 'calendar-embedded__content' : 'view__content'">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner   v-else-if="state.error" :message="state.error" :retry="load" />

        <template v-else>
          <!-- Month navigation -->
          <div class="calendar-nav">
            <button class="calendar-nav__btn" :aria-label="t('calendar.previous_month')" @click="prevMonth()">‹</button>
            <span class="calendar-nav__label">{{ monthLabel }}</span>
            <button class="calendar-nav__btn" :aria-label="t('calendar.next_month')" @click="nextMonth()">›</button>
          </div>

          <!-- Day headers -->
          <div class="calendar-grid" :style="{'--calendar-weeks': grid.length / 7}">
            <div
              v-for="h in dayHeaders" :key="h"
              class="calendar-grid__header">
              {{ h }}
            </div>

            <!-- Cells -->
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

              <!-- Status dots -->
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

          <!-- Legend -->
          <div class="calendar-legend">
            <span v-for="(color, status) in STATUS_COLORS" :key="status"
              class="calendar-legend__item">
              <span class="calendar-cell__dot" :style="{ background: color }" />
              {{ t('calendar.' + status) }}
            </span>
          </div>

          <!-- Selected-day panel -->
          <div v-if="state.selectedDate" class="calendar-day-panel">
            <div class="calendar-day-panel__heading">
              <div class="calendar-day-panel__date">{{ state.selectedDate }}</div>
              <div v-if="embedded && state.selectedSessions.length > 1" class="calendar-day-panel__pager">
                <button type="button" class="calendar-nav__btn" :aria-label="t('calendar.previous_session')"
                  :disabled="state.selectedSessionIndex === 0" @click="state.selectedSessionIndex--">‹</button>
                <span role="status">{{ t('calendar.session_position', {current:state.selectedSessionIndex + 1,total:state.selectedSessions.length}) }}</span>
                <button type="button" class="calendar-nav__btn" :aria-label="t('calendar.next_session')"
                  :disabled="state.selectedSessionIndex === state.selectedSessions.length - 1" @click="state.selectedSessionIndex++">›</button>
              </div>
            </div>

            <div v-if="!state.selectedSessions.length"
              class="calendar-day-panel__empty">
              {{ t('calendar.no_session') }}
            </div>

            <div
              v-for="session in visibleSessions"
              :key="session.id"
              class="calendar-day-session">
              <div class="calendar-day-session__summary">
                <div class="calendar-day-session__name">{{ session.name }}</div>
                <div class="calendar-day-session__status"
                  :style="{ color: session.status === 'skipped' ? 'var(--color-text-muted)' : STATUS_COLORS[session.status] }">
                  {{ t('calendar.' + session.status) }}
                </div>
              </div>

              <!-- Actions by status -->
              <div class="calendar-day-session__actions">
                <template v-if="session.status === 'completed'">
                  <button class="btn btn--secondary"
                    @click="viewSession(session)">
                    {{ t('calendar.view') }}
                  </button>
                </template>

                <template v-if="session.status === 'in_progress'">
                  <button class="btn btn--primary"
                    @click="router.push('#/session')">
                    {{ t('calendar.resume') }}
                  </button>
                </template>

                <template v-if="session.status === 'skipped'">
                  <button class="btn btn--secondary btn--sm"
                    :disabled="state.restoringId !== null"
                    @click="restoreSession(session)">
                    {{ t('calendar.restore') }}
                  </button>
                </template>

                <template v-if="session.status === 'planned'">
                  <button class="btn btn--primary"
                    @click="startSession(session)">
                    {{ t('calendar.start') }}
                  </button>
                  <button class="btn btn--secondary"
                    @click="openReschedule(session)">
                    {{ t('calendar.reschedule') }}
                  </button>
                  <button class="btn btn--secondary calendar-day-session__skip"
                    @click="openSkip(session)">
                    {{ t('calendar.mark_skipped') }}
                  </button>
                </template>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Rescheduling dialog -->
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

      <!-- Skip dialog -->
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
