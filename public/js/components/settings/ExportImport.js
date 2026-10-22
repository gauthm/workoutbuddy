import ModalDialog from '../common/ModalDialog.js'
import { reactive, inject } from '/vendor/vue.esm-browser.prod.js'
import { exportImport as api } from '../../api.js'
import { t } from '../../i18n.js'
import ConfirmModal from '../common/ConfirmModal.js'

export default {
  name: 'ExportImport',
  components: { ModalDialog, ConfirmModal },

  setup() {
    const store = inject('store')

    const state = reactive({
      exporting:         false,
      importing:         false,
      backingUp:         false,
      resetting:         false,
      showImportConfirm: false,
      showResetConfirm:  false,
      pendingFile:       null,   // File object awaiting import confirmation
    })

    // ── Export JSON ──────────────────────────────────────────
    async function exportJson() {
      state.exporting = true
      try {
        const blob     = await api.exportJson()
        const date     = new Date().toISOString().slice(0, 10)
        const filename = `workoutbuddy-export-${date}.json`
        downloadBlob(blob, filename)
        store.showToast(t('settings.export_json_done'), 'success')
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        state.exporting = false
      }
    }

    // ── Export CSV ───────────────────────────────────────────
    async function exportCsv(table) {
      try {
        const blob     = await api.exportCsv(table)
        const date     = new Date().toISOString().slice(0, 10)
        const filename = `${table}-${date}.csv`
        downloadBlob(blob, filename)
        store.showToast(t('settings.export_csv_done', { table }), 'success')
      } catch (err) {
        store.showToast(err.message, 'error')
      }
    }

    // ── Import JSON ──────────────────────────────────────────
    function onFileSelected(event) {
      const file = event.target.files[0]
      if (!file) return
      state.pendingFile       = file
      state.showImportConfirm = true
      // Reset the input so the same file can be selected again
      event.target.value = ''
    }

    async function confirmImport() {
      if (!state.pendingFile) return
      state.showImportConfirm = false
      state.importing         = true

      try {
        const text    = await state.pendingFile.text()
        const payload = JSON.parse(text)
        await api.importJson(payload)
        store.showToast(t('settings.import_success'), 'success')
        // Reload the page to apply the new settings
        setTimeout(() => window.location.reload(), 1000)
      } catch (err) {
        const msg = err.message === 'UNSUPPORTED_CUSTOM_EXERCISE'
          ? t('settings.import_custom_unsupported')
          : err.message || t('settings.import_invalid_format')
        store.showToast(t('settings.import_error', { error: msg }), 'error')
      } finally {
        state.importing   = false
        state.pendingFile = null
      }
    }

    // ── Manual backup ─────────────────────────────────────────
    async function backupNow() {
      state.backingUp = true
      try {
        const res = await api.backup()
        store.showToast(
          `${t('settings.backup_done')} (${res.backup_count} fichier(s))`,
          'success'
        )
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        state.backingUp = false
      }
    }

    // ── Reset ──────────────────────────────────────
    async function confirmReset() {
      if (state.resetting) return
      state.showResetConfirm = false
      state.resetting = true
      try {
        await api.resetAll()
        store.showToast(t('settings.reset_done'), 'success')
        setTimeout(() => window.location.reload(), 1000)
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally { state.resetting = false }
    }

    // ── Stats/history reset ─────────────────────
    const resetStatsState = reactive({ show: false, confirmText: '', resetting: false })

    async function confirmResetStats() {
      // Double confirmation: the user must type "RESET"
      if (resetStatsState.confirmText !== 'RESET') {
        store.showToast(t('settings.reset_stats_type_reset'), 'error')
        return
      }
      if (resetStatsState.resetting) return
      resetStatsState.resetting = true
      try {
        await api.resetStats()
        store.showToast(t('settings.reset_stats_done'), 'success')
        resetStatsState.show        = false
        resetStatsState.confirmText = ''
        setTimeout(() => window.location.reload(), 1200)
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        resetStatsState.resetting = false
      }
    }

    // ── Download helper ─────────────────────────────────
    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }

    return {
      state, exportJson, exportCsv, onFileSelected,
      confirmImport, backupNow, confirmReset,
      resetStatsState, confirmResetStats, t,
    }
  },

  template: `
    <div class="export-import">

      <!-- Export JSON -->
      <div class="export-import__row">
        <div>
          <div class="export-import__label">{{ t('settings.export_json') }}</div>
          <div class="export-import__hint">{{ t('settings.export_json_hint') }}</div>
        </div>
        <button class="btn btn--secondary export-import__btn"
          :disabled="state.exporting"
          @click="exportJson()">
          {{ state.exporting ? '…' : '↓ JSON' }}
        </button>
      </div>

      <!-- Sessions CSV export -->
      <div class="export-import__row">
        <div>
          <div class="export-import__label">{{ t('settings.export_csv') }}</div>
          <div class="export-import__hint">{{ t('settings.export_csv_hint') }}</div>
        </div>
        <button class="btn btn--secondary export-import__btn"
          @click="exportCsv('sessions')">
          ↓ CSV
        </button>
      </div>

      <!-- Sets CSV export -->
      <div class="export-import__row">
        <div>
          <div class="export-import__label">{{ t('settings.export_csv_sets') }}</div>
          <div class="export-import__hint">{{ t('settings.export_csv_sets_hint') }}</div>
        </div>
        <button class="btn btn--secondary export-import__btn"
          @click="exportCsv('set_logs')">
          ↓ CSV
        </button>
      </div>

      <!-- Import JSON -->
      <div class="export-import__row">
        <div>
          <div class="export-import__label">{{ t('settings.import_json') }}</div>
          <div class="export-import__hint" style="color:var(--color-warning)">
            {{ t('settings.import_json_hint') }}
          </div>
        </div>
        <label class="btn btn--secondary export-import__btn" style="cursor:pointer">
          {{ state.importing ? '…' : '↑ JSON' }}
          <input type="file" accept=".json" style="display:none"
            :disabled="state.importing"
            @change="onFileSelected" />
        </label>
      </div>

      <!-- Manual backup -->
      <div class="export-import__row">
        <div>
          <div class="export-import__label">{{ t('settings.backup_now') }}</div>
          <div class="export-import__hint">{{ t('settings.backup_hint') }}</div>
        </div>
        <button class="btn btn--secondary export-import__btn"
          :disabled="state.backingUp"
          @click="backupNow()">
          {{ state.backingUp ? '…' : '💾' }}
        </button>
      </div>

      <!-- Reset stats only -->
      <div class="export-import__row export-import__row--danger">
        <div>
          <div class="export-import__label" style="color:var(--color-warning)">
            {{ t('settings.reset_stats') }}
          </div>
          <div class="export-import__hint">
            {{ t('settings.reset_stats_hint') }}
          </div>
        </div>
        <button class="btn btn--secondary export-import__btn"
          style="color:var(--color-warning);border-color:var(--color-warning)"
          :aria-label="t('settings.reset_stats')" @click="resetStatsState.show = true">
          🗑
        </button>
      </div>

      <!-- Reset -->
      <div class="export-import__row export-import__row--danger">
        <div>
          <div class="export-import__label" style="color:var(--color-danger)">
            {{ t('settings.reset') }}
          </div>
          <div class="export-import__hint">
            {{ t('settings.reset_hint') }}
          </div>
        </div>
        <button class="btn btn--danger export-import__btn"
          :disabled="state.resetting" :aria-label="t('settings.reset')" @click="state.showResetConfirm = true">
          🗑
        </button>
      </div>

      <!-- Import confirmation -->
      <ConfirmModal
        v-if="state.showImportConfirm"
        :title="t('settings.import_json')"
        :body="t('settings.import_confirm')"
        :danger="true"
        :confirm-text="t('common.confirm')"
        @confirm="confirmImport()"
        @cancel="state.showImportConfirm = false; state.pendingFile = null"
      />

      <!-- Reset confirmation -->
      <ConfirmModal
        v-if="state.showResetConfirm"
        :title="t('settings.reset')"
        :body="t('settings.reset_confirm')"
        :danger="true"
        :confirm-text="t('settings.reset')"
        @confirm="confirmReset()"
        @cancel="state.showResetConfirm = false"
      />

      <!-- Stats double-confirmation dialog -->
      <ModalDialog v-if="resetStatsState.show" :title="t('settings.reset_stats')" @close="resetStatsState.show = false; resetStatsState.confirmText = ''">
          <p class="settings-reset-stats__desc">
            {{ t('settings.reset_stats_desc') }}
          </p>
          <div class="form-group">
            <label class="form-label" for="ExportImport-resetStatsState-confirmText">
              {{ t('settings.reset_stats_prompt', { word: 'RESET' }) }}
            </label>
            <input id="ExportImport-resetStatsState-confirmText"
              class="form-input settings-reset-stats__input"
              type="text"
              v-model="resetStatsState.confirmText"
              placeholder="RESET"
              autocomplete="off"
            />
          </div>
          <div class="modal__actions">
            <button class="btn btn--secondary"
              @click="resetStatsState.show = false; resetStatsState.confirmText = ''">
              {{ t('common.cancel') }}
            </button>
            <button class="btn btn--danger"
              :disabled="resetStatsState.confirmText !== 'RESET' || resetStatsState.resetting"
              @click="confirmResetStats()">
              {{ resetStatsState.resetting ? t('common.loading') : t('settings.reset_stats_confirm_btn') }}
            </button>
          </div>

      </ModalDialog>
    </div>
  `
}
