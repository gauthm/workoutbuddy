import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { programs as api, sessions as sessionsApi } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'
import ConfirmModal   from '../common/ConfirmModal.js'

export default {
  name: 'ProgramDetailView',
  props: { id: { type: String, required: true } },
  components: { PageHeader, LoadingSpinner, ErrorBanner, ConfirmModal },

  setup(props) {
    const router = inject('router')
    const store  = inject('store')
    const state = reactive({
      loading: false, error: null, program: null,
      activating: false, showDeleteConfirm: false,
    })

    async function load() {
      state.loading = true; state.error = null
      try { state.program = await api.get(props.id) }
      catch (err) { state.error = err.message }
      finally { state.loading = false }
    }

    async function activate() {
      state.activating = true
      try {
        await api.activate(props.id)
        store.showToast(t('programs.activated'), 'success')
        await load()
      } catch (err) { store.showToast(err.message, 'error') }
      finally { state.activating = false }
    }

    async function startNextSession() {
      try {
        const next = await api.nextSession(props.id)
        const sessionRes = await sessionsApi.fromTemplate(next.template_id, {
          scheduled_date: next.suggested_date
        })
        const startRes   = await sessionsApi.start(sessionRes.id)
        store.setActiveSession(startRes)
        store.setPendingAdjustments(startRes.adjustments || [])
        router.push('#/session')
      } catch (err) { store.showToast(err.message, 'error') }
    }

    async function doDelete() {
      try {
        await api.delete(props.id)
        store.showToast(t('programs.deleted'), 'success')
        router.push('#/programs')
      } catch (err) {
        store.showToast(err.message, 'error')
        state.showDeleteConfirm = false
      }
    }

    onMounted(load)
    return { state, load, activate, startNextSession, doDelete, router, t }
  },

  template: `
    <div class="view">
      <PageHeader :title="state.program?.name || '…'" :show-back="true">
        <template #actions>
          <button class="btn btn--secondary"
            style="padding:0.4rem 0.75rem;font-size:0.85rem"
            @click="router.push('#/programs/' + id + '/edit')">
            {{ t('common.edit') }}
          </button>
        </template>
      </PageHeader>
      <div class="view__content" style="padding:1rem">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner v-else-if="state.error" :message="state.error" :retry="load" />

        <template v-else-if="state.program">
          <!-- Infos -->
          <div class="detail-section">
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem">
              <span class="chip chip--active">{{ state.program.goal }}</span>
              <span class="chip chip--active">{{ state.program.level }}</span>
              <span class="chip chip--active">{{ state.program.days_per_week }}{{ t('programs.days_short') }}</span>
              <span v-if="state.program.is_active" class="badge badge--active">
                {{ t('programs.active_badge') }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div style="display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1.5rem">
            <button v-if="state.program.is_active" class="btn btn--primary btn--full"
              @click="startNextSession()">
              {{ t('programs.start_session') }}
            </button>
            <button v-else class="btn btn--secondary btn--full"
              :disabled="state.activating" @click="activate()">
              {{ state.activating ? t('common.loading') : t('programs.activate') }}
            </button>
          </div>

          <!-- Templates -->
          <div class="detail-section">
            <h3 class="detail-section__title">{{ t('programs.templates') }}</h3>
            <div v-for="tpl in state.program.templates" :key="tpl.id"
              class="template-block">
              <div class="template-block__name">{{ tpl.name }}</div>
              <div v-for="ex in tpl.exercises" :key="ex.id"
                class="template-block__exercise">
                {{ ex.exercise_id.replace(/_/g,' ') }}
                — {{ ex.target_sets }}×{{ ex.target_reps_min }}
                <template v-if="ex.target_reps_max !== ex.target_reps_min">
                  –{{ ex.target_reps_max }}
                </template>
              </div>
            </div>
          </div>

          <!-- Supprimer -->
          <button class="btn btn--danger btn--full" style="margin-top:2rem"
            @click="state.showDeleteConfirm = true">
            {{ t('common.delete') }}
          </button>
        </template>
      </div>

      <ConfirmModal
        v-if="state.showDeleteConfirm"
        :title="t('programs.delete_confirm')"
        :danger="true"
        @confirm="doDelete()"
        @cancel="state.showDeleteConfirm = false"
      />
    </div>
  `
}
