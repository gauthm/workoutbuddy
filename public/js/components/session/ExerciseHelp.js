import ExerciseMotion from '../exercises/ExerciseMotion.js'
import { estimate1RM, rmTable } from '../../utils/rm.js'
import { t } from '../../i18n.js'
import { useDialog } from '../../utils/dialog.js'

export default {
  name: 'ExerciseHelp', components:{ExerciseMotion},
  props: {
    exercise:      { type: Object, required: true },
    lastWeight:    { type: Number, default: 0 },
    lastReps:      { type: Number, default: 0 },
    formula:       { type: String, default: 'epley' },
    history:       { type: Array, default: () => [] },
  },
  emits: ['close'],

  setup(props, { emit }) {
    const rm = props.lastWeight && props.lastReps
      ? estimate1RM(props.lastWeight, props.lastReps, props.formula)
      : 0
    const table = rm > 0 ? rmTable(rm, props.formula).filter(r => r.reps <= 12) : []
    return { rm, table, t, dialogRef: useDialog(() => emit('close')) }
  },

  template: `
    <div class="modal-overlay" @click.self="$emit('close')">
      <div ref="dialogRef" class="modal" role="dialog" aria-modal="true" :aria-label="exercise.name_fr" tabindex="-1" style="border-radius:var(--radius-lg);max-height:85dvh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <h2 class="modal__title" style="margin:0">{{ exercise.name_fr }}</h2>
          <button style="background:none;border:none;color:var(--color-text-muted);font-size:1.5rem;cursor:pointer"
            :aria-label="t('common.close')" @click="$emit('close')">✕</button>
        </div>

        <ExerciseMotion v-if="exercise.image_paths?.length" :paths="exercise.image_paths" :name="exercise.name_fr" :max-height="180" />

        <!-- Instructions -->
        <div v-if="exercise.instructions_fr?.length" class="detail-section">
          <h3 class="detail-section__title">{{ t('exercises.instructions') }}</h3>
          <ol style="padding-left:1.25rem">
            <li v-for="(step,i) in exercise.instructions_fr" :key="i"
              style="margin-bottom:0.4rem;font-size:0.9rem;line-height:1.5">
              {{ step }}
            </li>
          </ol>
        </div>

        <!-- Tableau RM -->
        <div v-if="table.length" class="detail-section">
          <h3 class="detail-section__title">{{ t('session.rm_table') }} (RM ≈ {{ rm }} kg)</h3>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.4rem">
            <div v-for="row in table" :key="row.reps"
              style="background:var(--color-surface-2);padding:0.4rem;border-radius:var(--radius-sm);text-align:center;font-size:0.85rem">
              <div style="font-weight:600">{{ row.weight_kg }} kg</div>
              <div style="color:var(--color-text-muted);font-size:0.75rem">{{ row.reps }} rep{{ row.reps > 1 ? 's' : '' }}</div>
            </div>
          </div>
        </div>

        <!-- Historique -->
        <div v-if="history.length" class="detail-section">
          <h3 class="detail-section__title">{{ t('exercises.history') }}</h3>
          <div v-for="s in history.slice(0,5)" :key="s.session_id"
            style="margin-bottom:0.6rem">
            <div style="font-size:0.8rem;color:var(--color-text-muted)">{{ s.scheduled_date }}</div>
            <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.2rem">
              <span v-for="set in s.sets.filter(x=>x.is_completed)" :key="set.set_id"
                style="background:var(--color-surface-2);padding:2px 8px;border-radius:4px;font-size:0.8rem">
                {{ set.weight_kg }}kg × {{ set.reps }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}
