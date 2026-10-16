import ModalDialog from '../common/ModalDialog.js'
import { reactive, ref, onMounted, onBeforeUnmount, inject, nextTick }
  from '/vendor/vue.esm-browser.prod.js'
import { coach as coachApi, userProfile as profileApi } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader        from '../layout/PageHeader.js'
import LoadingSpinner    from '../common/LoadingSpinner.js'
import ChatMessage       from './ChatMessage.js'
import AdviceCard        from './AdviceCard.js'
import UserProfileCard   from './UserProfileCard.js'
import ConfirmModal      from '../common/ConfirmModal.js'

export default {
  name: 'CoachView',
  components: { ModalDialog,
    PageHeader, LoadingSpinner,
    ChatMessage, AdviceCard, UserProfileCard,
    ConfirmModal,
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
      notConfigured:  false,
      showProfile:    false,
      conversationId: null,
      conversations:  [],
      showHistory:    false,
      loadingHistory: false,
      deleteTarget:   null,   // conversation à supprimer
    })

    const inputRef       = ref(null)
    const messagesEndRef = ref(null)
    let streamController = null
    onBeforeUnmount(() => { streamController?.abort() })

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

        // Restauration du fil actif
        const list = await coachApi.conversations()
        state.conversations = list.conversations
        const active = list.conversations.find(c => c.is_active === 1)
        if (active) {
          state.conversationId = active.id
          const detail = await coachApi.messages(active.id)
          state.messages = detail.messages.map(m => ({ role: m.role, content: m.content }))
        }
      } catch (_) {}
      finally { state.loadingInit = false }

    })

    // ── Envoi d'un message ─────────────────────────────────────
    async function sendMessage(text, silent = false) {
      const trimmed = (text || state.input).trim()
      if (!trimmed || state.isStreaming) return

      if (!silent) {
        state.input = ''
        nextTick(() => resizeInput(inputRef.value))
      }

      // Message utilisateur
      state.messages.push({ role: 'user', content: trimmed })
      await scrollToBottom()

      // Message assistant en cours de streaming
      const assistantMsg = reactive({ role: 'assistant', content: '', isStreaming: true })
      state.messages.push(assistantMsg)
      state.isStreaming = true

      try {
        streamController = new AbortController()
        const res = await coachApi.chat({
          message: trimmed,
          ...(state.conversationId ? { conversation_id: state.conversationId } : {}),
        }, { signal: streamController.signal })

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
            if (event.type === 'error') {
              assistantMsg.content   = event.message
              assistantMsg.isError   = true
              assistantMsg.isStreaming = false
            }
            if (event.type === 'done') {
              assistantMsg.isStreaming = false
              if (event.conversation_id) state.conversationId = event.conversation_id
            }
          }
        }

      } catch (err) {
        if (err.name === 'AbortError') return
        assistantMsg.content    = `${t('coach.error_generic')} : ${err.message}`
        assistantMsg.isError    = true
        assistantMsg.isStreaming = false
      } finally {
        assistantMsg.isStreaming = false
        state.isStreaming = false
        await scrollToBottom()
      }
    }

    // ── Historique des conversations ───────────────────────────
    async function refreshConversations() {
      try { state.conversations = (await coachApi.conversations()).conversations } catch (_) {}
    }

    async function newConversation() {
      try {
        const conv = await coachApi.createConversation()
        state.conversationId = conv.id
        state.messages       = []
          state.showHistory    = false
        await refreshConversations()
      } catch (err) { store.showToast(err.message, 'error') }
    }

    async function openHistoryPanel() {
      state.showHistory = true
      state.loadingHistory = true
      await refreshConversations()
      state.loadingHistory = false
    }

    async function selectConversation(conv) {
      if (state.isStreaming) return
      try {
        await coachApi.activateConversation(conv.id)
        const detail = await coachApi.messages(conv.id)
        state.conversationId = conv.id
        state.messages       = detail.messages.map(m => ({ role: m.role, content: m.content }))
          state.showHistory    = false
        await scrollToBottom()
      } catch (err) { store.showToast(err.message, 'error') }
    }

    async function renameConversation(conv) {
      const title = window.prompt(t('coach.rename_prompt'), conv.title)
      if (!title?.trim()) return
      try {
        await coachApi.renameConversation(conv.id, title.trim())
        await refreshConversations()
      } catch (err) { store.showToast(err.message, 'error') }
    }

    function askDeleteConversation(conv) { state.deleteTarget = conv }

    async function confirmDeleteConversation() {
      if (!state.deleteTarget) return
      try {
        await coachApi.deleteConversation(state.deleteTarget.id)
        if (state.deleteTarget.id === state.conversationId) {
          state.conversationId = null
          state.messages       = []
        }
        state.deleteTarget = null
        store.showToast(t('coach.conversation_deleted'), 'success')
        await refreshConversations()
      } catch (err) { store.showToast(err.message, 'error') }
    }

    // ── Gestion clavier ────────────────────────────────────────
    function onKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault()
        sendMessage()
      }
    }

    // ── Auto-resize textarea ───────────────────────────────────
    function resizeInput(input) {
      if (!input) return
      input.style.height = 'auto'
      input.style.overflowY = 'hidden'
      const style = getComputedStyle(input)
      const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
      const limit = parseFloat(style.maxHeight)
      const height = input.scrollHeight + border
      input.style.height = Math.min(height, limit) + 'px'
      input.style.overflowY = height > limit ? 'auto' : 'hidden'
    }
    function autoResize(e) {
      resizeInput(e.target)
    }

    function onAdviceDismissed(id) { state.advice = state.advice.filter(a => a.id !== id) }
    function onAdvicePurchased(id) { state.advice = state.advice.filter(a => a.id !== id) }

    return {
      state, inputRef, messagesEndRef,
      sendMessage,
      newConversation, openHistoryPanel, selectConversation,
      renameConversation, askDeleteConversation, confirmDeleteConversation,
      onAdviceDismissed, onAdvicePurchased,
      onKeydown, autoResize, t, router,
    }
  },

  template: `
    <div class="view coach-view">
      <PageHeader :title="t('coach.title')">
        <template #actions>
          <button class="icon-btn" @click="openHistoryPanel()"
            :title="t('coach.history_title')" :aria-label="t('coach.history_title')">🕘</button>
          <button class="icon-btn" @click="newConversation()"
            :title="t('coach.new_conversation')" :aria-label="t('coach.new_conversation')">＋</button>
          <button v-if="state.profile?.fitness_level" class="icon-btn"
            @click="state.showProfile = !state.showProfile"
            :title="t('coach.profile_title')" :aria-label="t('coach.profile_title')">👤</button>
        </template>
      </PageHeader>

      <div class="coach-view__content">
        <LoadingSpinner v-if="state.loadingInit" />

        <template v-else>
          <p class="settings-notice coach-readonly">{{ t('coach.readonly') }}</p>
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
            <div v-if="!state.messages.length"
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

            <div ref="messagesEndRef" style="height:16px" />
          </div>
        </template>
      </div>

      <!-- Panneau historique des conversations -->
      <ModalDialog v-if="state.showHistory" :title="t('coach.history_title')" @close="state.showHistory = false">

          <div v-if="!state.conversations.length && !state.loadingHistory"
            class="coach-history__empty">{{ t('coach.history_empty') }}</div>

          <div v-for="c in state.conversations" :key="c.id" class="coach-history__row"
            :class="{ 'coach-history__row--active': c.id === state.conversationId }"
            @click="selectConversation(c)">
            <div class="coach-history__main">
              <div class="coach-history__title">{{ c.title }}</div>
              <div class="coach-history__meta">
                {{ c.message_count }} msg
                <template v-if="c.last_message_at"> · {{ c.last_message_at.slice(0, 10) }}</template>
              </div>
            </div>
            <button class="coach-history__btn" :title="t('coach.rename')"
              @click.stop="renameConversation(c)" :aria-label="t('coach.rename')">✏️</button>
            <button class="coach-history__btn" :title="t('common.delete')"
              @click.stop="askDeleteConversation(c)" :aria-label="t('common.delete')">🗑</button>
          </div>

      </ModalDialog>

      <ConfirmModal
        v-if="state.deleteTarget"
        :title="t('coach.delete_confirm_title')"
        :body="t('coach.delete_confirm_body', { title: state.deleteTarget.title })"
        :danger="true"
        :confirm-text="t('common.delete')"
        @confirm="confirmDeleteConversation()"
        @cancel="state.deleteTarget = null"
      />

      <!-- Zone de saisie -->
      <div class="coach-view__input-area">
        <textarea
          ref="inputRef"
          class="coach-view__input"
          v-model="state.input"
          :placeholder="t('coach.placeholder')"
          :aria-label="t('coach.placeholder')"
          :disabled="state.isStreaming || state.loadingInit"
          rows="1"
          @keydown="onKeydown"
          @input="autoResize"
        />
        <button
          class="coach-view__send"
          :aria-label="t('coach.send')"
          :disabled="!state.input.trim() || state.isStreaming || state.loadingInit"
          @click="sendMessage()">
          {{ state.isStreaming ? '…' : '↑' }}
        </button>
      </div>
    </div>
  `
}
