import { t } from '../../i18n.js'

export default {
  name: 'ChatMessage',
  props: {
    message: { type: Object, required: true }
    // { role:'user'|'assistant', content:string, isStreaming?:bool, isError?:bool }
  },
  setup() { return { t } },
  template: `
    <div class="chat-msg" :class="'chat-msg--' + message.role">
      <div class="chat-msg__avatar" v-if="message.role==='assistant'">🤖</div>
      <div class="chat-msg__bubble"
        :class="{
          'chat-msg__bubble--streaming': message.isStreaming,
          'chat-msg__bubble--error':     message.isError,
        }">
        <span v-if="message.isStreaming && !message.content"
          class="chat-msg__thinking">{{ t('coach.thinking') }}</span>
        <span v-else style="white-space:pre-wrap;word-break:break-word">{{ message.content }}</span>
        <span v-if="message.isStreaming && message.content" class="chat-msg__cursor">▋</span>
      </div>
      <div class="chat-msg__avatar" v-if="message.role==='user'">🧑</div>
    </div>
  `
}
