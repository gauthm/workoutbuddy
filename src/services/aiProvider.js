import { message } from '../utils/messages.js'
const AI_TIMEOUT_MS = 30_000

// ── URL normalization ─────────────────────────────────────────
/**
 * Ensure the URL ends in "/v1" without a trailing slash.
 * Handled cases:
 *   "https://api.openai.com"       → "https://api.openai.com/v1"
 *   "https://api.openai.com/"      → "https://api.openai.com/v1"
 *   "https://api.openai.com/v1"    → "https://api.openai.com/v1"
 *   "https://api.openai.com/v1/"   → "https://api.openai.com/v1"
 *   "http://localhost:11434"       → "http://localhost:11434/v1"
 *   "https://api.groq.com/openai"  → "https://api.groq.com/openai/v1"
 */
export function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return ''
  let u = url.trim().replace(/\/+$/, '')
  if (!u.endsWith('/v1')) u = u + '/v1'
  return u
}

// ── Read the stream line by line ────────────────────────────
async function* readLines(body) {
  const reader  = body.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ''
  try {
  while (true) {
    const { done, value } = await reader.read()
    if (done) { buffer += decoder.decode(); if (buffer.trim()) yield buffer; break }
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) yield line
  }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

// ── Streaming Chat Completions ────────────────────────────────
/**
 * Async generator → parsed SSE events.
 * Types : { type:'token', content } | { type:'done', usage } | { type:'error', message }
 *
 * Compatible OpenAI, Groq, Mistral, Ollama, LM Studio, OpenRouter.
 */
export async function* streamChat(messages, aiSettings, { signal } = {}) {
  const { base_url, api_key, model } = aiSettings

  if (!base_url || !model) {
    yield { type: 'error', message: message('ai.setup_required') }
    return
  }

  const url        = normalizeBaseUrl(base_url) + '/chat/completions'
  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${api_key || 'no-key'}`,
      },
      body: JSON.stringify({ model, messages, stream: true, max_tokens: 4000 }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      yield { type: 'error', message: httpErrorMessage(res.status, body) }
      return
    }

    let usage = null
    for await (const line of readLines(res.body)) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim()
      if (raw === '[DONE]') { yield { type: 'done', usage }; return }
      if (!raw) continue
      let parsed
      try { parsed = JSON.parse(raw) } catch { continue }

      // Support OpenAI delta and Ollama message formats
      const token =
        parsed.choices?.[0]?.delta?.content ??
        parsed.choices?.[0]?.message?.content ?? ''

      if (token) yield { type: 'token', content: token }
      if (parsed.usage) usage = parsed.usage
    }
    yield { type: 'done', usage }

  } catch (err) {
    if (err.name === 'AbortError') {
      yield { type: 'error', message: message('ai.connection_timeout') }
    } else {
      yield { type: 'error', message: message('ai.network_error', { error: err.message }) }
    }
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

// ── List models ────────────────────────────────────────
export async function listModels(aiSettings) {
  const { base_url, api_key } = aiSettings
  if (!base_url) throw new Error(message('ai.missing_base_url'))
  const url        = normalizeBaseUrl(base_url) + '/models'
  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${api_key || 'no-key'}` },
      signal: controller.signal,
    })
    if (!res.ok) { const b = await res.text().catch(()=>''); throw new Error(httpErrorMessage(res.status, b)) }
    const data  = await res.json()
    const items = data.data || data.models || []
    return { models: items.map(m => ({ id: m.id||m.name||String(m), name: m.name||m.id||String(m) })) }
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(message('ai.timeout'))
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

// ── Connection test ─────────────────────────────────────────
export async function testConnection(aiSettings) {
  const start = Date.now()
  let collected = ''
  for await (const event of streamChat([{ role:'user', content:'Reply with exactly the word: OK' }], aiSettings)) {
    if (event.type === 'token') collected += event.content
    if (event.type === 'error') throw new Error(event.message)
    if (event.type === 'done')  break
  }
  return { success: true, latency_ms: Date.now() - start, model: aiSettings.model }
}

// ── Collect a stream into a string ─────────────────────────
export async function collectStream(messages, aiSettings) {
  let text = ''
  for await (const event of streamChat(messages, aiSettings)) {
    if (event.type === 'token') text += event.content
    if (event.type === 'error') throw new Error(event.message)
    if (event.type === 'done')  break
  }
  return text.trim()
}

// ── HTTP error messages ────────────────────────────────────
function httpErrorMessage(status, body) {
  const p = body ? body.slice(0, 200) : ''
  switch (status) {
    case 401: return message('ai.invalid_key')
    case 403: return message('ai.access_denied')
    case 404: return message('ai.endpoint_not_found')
    case 429: return message('ai.rate_limit')
    case 500: return message('ai.server_error')
    case 503: return message('ai.unavailable')
    default:  return message('ai.http_error', { status: status, detail: p ? ' : ' + p : '' })
  }
}
