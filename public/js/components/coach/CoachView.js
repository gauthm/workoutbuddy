import { reactive, ref, onMounted, inject, nextTick }
  from '/vendor/vue.esm-browser.prod.js'
import { coach as coachApi, userProfile as profileApi } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader        from '../layout/PageHeader.js'
import LoadingSpinner    from '../common/LoadingSpinner.js'
import ChatMessage       from './ChatMessage.js'
import ActionPreview     from './ActionPreview.js'
import AdviceCard        from './AdviceCard.js'
import UserProfileCard   from './UserProfileCard.js'
import OnboardingBanner  from './OnboardingBanner.js'

export default {
  name: 'CoachView',
  components: {
    PageHeader, LoadingSpinner,
    ChatMessage, ActionPreview, AdviceCard, UserProfileCard, OnboardingBanner,
  },

  setup() {
    const router = inject('router')
    const store  = inject('store')

    const state = reactive({
      messages:       [],
      advice:         [],
      profile:        null,
      loadingInit:    true,
      isStreaming:    false,
      input:          '',
      pendingActions: [],    // actions reçues du stream, en attente de confirmation
      currentActionIdx: 0,  // index dans pendingActions
      applying:       false,
      notConfigured:  false,
      showProfile:    false,
    })

    const inputRef       = ref(null)
    const messagesEndRef = ref(null)

    // ── Historique pour le contexte ────────────────────────────
    function getHistory() {
      return state.messages
        .filter(m => !m.isError)
        .slice(-14)
        .map(m => ({ role: m.role, content: m.content }))
    }

    async function scrollToBottom() {
      await nextTick()
      messagesEndRef.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }

    // ── Initialisation ─────────────────────────────────────────
    onMounted(async () => {
      try {
        const [profileData, adviceData] = await Promise.all([
          profileApi.get(),
          coachApi.advice(),
        ])
        state.profile = profileData
        state.advice  = adviceData.advice
      } catch (_) {}
      finally { state.loadingInit = false }
    })

    // ── Démarrage de l'onboarding ──────────────────────────────
    async function startOnboarding() {
      // Envoyer un message invisible qui déclenche l'onboarding dans le prompt
      await sendMessage('Bonjour ! Je veux configurer mon profil et créer mon programme.', true)
    }

    // ── Envoi d'un message ─────────────────────────────────────
    async function sendMessage(text, silent = false) {
      const trimmed = (text || state.input).trim()
      if (!trimmed || state.isStreaming) return

      if (!silent) state.input = ''
      state.pendingActions = []
      state.currentActionIdx = 0

      // Message utilisateur
      state.messages.push({ role: 'user', content: trimmed })
      await scrollToBottom()

      // Message assistant en cours de streaming
      const assistantMsg = reactive({ role: 'assistant', content: '', isStreaming: true })
      state.messages.push(assistantMsg)
      state.isStreaming = true

      try {
        const res = await fetch('/api/v1/ai/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ message: trimmed, history: getHistory() }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          if (data.error === 'AI_NOT_CONFIGURED') state.notConfigured = true
          assistantMsg.content    = data.error === 'AI_NOT_CONFIGURED'
            ? t('coach.not_configured')
            : t('coach.error_generic')
          assistantMsg.isError    = true
          assistantMsg.isStreaming = false
          return
        }

        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let   buffer  = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (!raw) continue
            let event
            try { event = JSON.parse(raw) } catch { continue }

            if (event.type === 'token') {
              assistantMsg.content += event.content
              await scrollToBottom()
            }
            if (event.type === 'action') {
              state.pendingActions.push(event.action)
            }
            if (event.type === 'error') {
              assistantMsg.content   = event.message
              assistantMsg.isError   = true
              assistantMsg.isStreaming = false
            }
            if (event.type === 'done') {
              assistantMsg.isStreaming = false
            }
          }
        }

      } catch (err) {
        assistantMsg.content    = `${t('coach.error_generic')} : ${err.message}`
        assistantMsg.isError    = true
        assistantMsg.isStreaming = false
      } finally {
        assistantMsg.isStreaming = false
        state.isStreaming = false
        await scrollToBottom()
      }
    }

    // ── Confirmation d'une action ──────────────────────────────
    async function applyCurrentAction() {
      if (!state.pendingActions.length || state.applying) return
      state.applying = true

      // Si plusieurs actions, les appliquer toutes en lot
      if (state.pendingActions.length > 1) {
        try {
          const res = await fetch('/api/v1/ai/apply-actions', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actions: state.pendingActions }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error((data.details||[]).join('; ') || data.error)
          store.showToast(t('coach.actions_applied', { n: data.applied }), 'success')
          await refreshAfterActions(data.results)
        } catch (err) {
          store.showToast(t('coach.action_error', { error: err.message }), 'error')
        }
      } else {
        // Une seule action
        try {
          const res = await fetch('/api/v1/ai/apply-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: state.pendingActions[0] }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error((data.details||[]).join('; ') || data.error)
          store.showToast(t('coach.action_applied'), 'success')
          await refreshAfterActions([data.result])
        } catch (err) {
          store.showToast(t('coach.action_error', { error: err.message }), 'error')
        }
      }

      state.pendingActions   = []
      state.currentActionIdx = 0
      state.applying         = false
    }

    async function refreshAfterActions(results) {
      // Rediriger selon les résultats
      const programResult = results?.find(r => r?.type === 'program')
      const sessionResult = results?.find(r => r?.type === 'session')

      // Rafraîchir le profil si mis à jour
      if (results?.some(r => r?.type === 'profile')) {
        state.profile = await profileApi.get()
      }

      if (programResult) {
        setTimeout(() => router.push('#/programs/' + programResult.id), 800)
      } else if (sessionResult) {
        setTimeout(() => router.push('#/session/history'), 800)
      }
    }

    function cancelActions() {
      state.pendingActions   = []
      state.currentActionIdx = 0
      state.messages.push({ role: 'assistant', content: t('coach.action_cancelled') })
    }

    // ── Gestion clavier ────────────────────────────────────────
    function onKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    }

    // ── Auto-resize textarea ───────────────────────────────────
    function autoResize(e) {
      e.target.style.height = 'auto'
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
    }

    function onAdviceDismissed(id) { state.advice = state.advice.filter(a => a.id !== id) }
    function onAdvicePurchased(id) { state.advice = state.advice.filter(a => a.id !== id) }

    return {
      state, inputRef, messagesEndRef,
      sendMessage, startOnboarding,
      applyCurrentAction, cancelActions,
      onAdviceDismissed, onAdvicePurchased,
      onKeydown, autoResize, t, router,
    }
  },

  template: `
    <div class="view coach-view">
      <PageHeader :title="t('coach.title')">
        <template #actions>
          <button v-if="state.profile?.fitness_level" class="icon-btn"
            @click="state.showProfile = !state.showProfile"
            :title="t('coach.profile_title')">👤</button>
        </template>
      </PageHeader>

      <div class="coach-view__content">
        <LoadingSpinner v-if="state.loadingInit" />

        <template v-else>
          <!-- Profil (accordéon) -->
          <div v-if="state.showProfile && state.profile">
            <UserProfileCard :profile="state.profile" />
          </div>

          <!-- Conseils coaching -->
          <div v-if="state.advice.length" class="coach-view__advice-section">
            <div class="detail-section__title" style="padding:0 1rem;margin-top:0.75rem">
              {{ t('coach.advice_section') }}
            </div>
            <AdviceCard
              v-for="adv in state.advice" :key="adv.id"
              :advice="adv"
              @dismissed="onAdviceDismissed"
              @purchased="onAdvicePurchased"
            />
          </div>

          <!-- Onboarding Banner (si profil incomplet et pas encore de messages) -->
          <OnboardingBanner
            v-if="!state.profile?.onboarding_completed && !state.messages.length"
            @start="startOnboarding()"
            @skip="router.push('#/settings')"
          />

          <!-- Provider non configuré -->
          <div v-if="state.notConfigured && !state.messages.length"
            class="coach-view__not-configured">
            <p>{{ t('coach.not_configured') }}</p>
            <button class="btn btn--primary" @click="router.push('#/settings')">
              {{ t('coach.go_to_settings') }}
            </button>
          </div>

          <!-- Zone de messages -->
          <div class="coach-view__messages">
            <!-- Placeholder si vide et profil complet -->
            <div v-if="!state.messages.length && state.profile?.onboarding_completed"
              class="coach-view__empty">
              <div style="font-size:3rem;margin-bottom:0.75rem">🤖</div>
              <p style="color:var(--color-text-muted);text-align:center;padding:0 2rem;font-size:0.9rem">
                {{ t('coach.no_messages') }}
              </p>
            </div>

            <ChatMessage
              v-for="(msg, i) in state.messages" :key="i"
              :message="msg"
            />

            <!-- Actions en attente -->
            <template v-if="state.pendingActions.length && !state.isStreaming">
              <ActionPreview
                v-for="(action, idx) in state.pendingActions" :key="idx"
                :action="action"
                :index="idx"
                :total="state.pendingActions.length"
                :applying="state.applying"
                @confirm="applyCurrentAction()"
                @cancel="cancelActions()"
              />
            </template>

            <div ref="messagesEndRef" style="height:4px" />
          </div>
        </template>
      </div>

      <!-- Zone de saisie -->
      <div class="coach-view__input-area">
        <textarea
          ref="inputRef"
          class="coach-view__input"
          v-model="state.input"
          :placeholder="t('coach.placeholder')"
          :disabled="state.isStreaming || state.loadingInit"
          rows="1"
          @keydown="onKeydown"
          @input="autoResize"
        />
        <button
          class="coach-view__send"
          :disabled="!state.input.trim() || state.isStreaming || state.loadingInit"
          @click="sendMessage()">
          {{ state.isStreaming ? '…' : '↑' }}
        </button>
      </div>
    </div>
  `
}
