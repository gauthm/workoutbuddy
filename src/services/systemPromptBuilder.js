import { calculateAchievableLoads } from './equipmentCalc.js'

/**
 * Build the complete system prompt for the expert coach.
 * Called for every /ai/chat request to include up-to-date data.
 * @param {object} db - better-sqlite3 instance
 * @returns {string} system prompt
 */
export function buildSystemPrompt(db) {
  const profile  = db.prepare('SELECT * FROM user_profile WHERE id = 1').get()
  const equipment= db.prepare('SELECT * FROM equipment_item').all()
  const program  = db.prepare("SELECT * FROM program WHERE is_active = 1 LIMIT 1").get()
  const sessions = db.prepare(`
    SELECT s.name, s.scheduled_date, s.duration_seconds, s.total_volume_kg, s.rpe_avg
    FROM session s WHERE s.status = 'completed'
    ORDER BY s.completed_at DESC LIMIT 5
  `).all()
  const progStates = program ? db.prepare(`
    SELECT e.name_fr, ps.current_weight_kg, ps.current_target_reps, ps.consecutive_failures,
           te.target_sets, te.target_reps_min, te.target_reps_max, te.progression_model
    FROM progression_state ps
    JOIN template_exercise te ON ps.template_exercise_id = te.id
    JOIN workout_template  wt ON te.workout_template_id  = wt.id
    JOIN exercise           e ON te.exercise_id = e.id
    WHERE wt.program_id = ?
    ORDER BY ps.last_updated DESC LIMIT 15
  `).all(program.id): []
  const records = db.prepare(`
    SELECT e.name_fr, pr.reps, pr.weight_kg, pr.estimated_1rm_kg, pr.achieved_date
    FROM personal_record pr JOIN exercise e ON pr.exercise_id = e.id
    ORDER BY pr.estimated_1rm_kg DESC LIMIT 8
  `).all()
  const activeAdvice = db.prepare(
    "SELECT signal_type, exercise_id, advice_text FROM equipment_advice WHERE status='active' LIMIT 5"
  ).all()
  const excludedExercises = db.prepare(
    "SELECT id, name_fr, exclusion_reason FROM exercise WHERE is_excluded = 1 LIMIT 20"
  ).all()

  // ── Context sections ──────────────────────────────────
  const programPlan = program ? db.prepare('SELECT parameters FROM program_plan WHERE program_id=?').get(program.id): null
  const parameters = programPlan ? JSON.parse(programPlan.parameters): null
  const profileText = buildProfileSection(profile)
  const programPreferences = parameters ? JSON.stringify(parameters): 'Existing program: detailed preferences not recorded.'
  const equipText   = buildEquipmentSection(equipment, db)
  const excludedText = excludedExercises.length === 0
    ? 'No excluded exercises.'
   : excludedExercises.map(e =>
        `- ${e.name_fr} (${e.id})${e.exclusion_reason ? ' — ' + e.exclusion_reason: ''}`
      ).join('\n')
  const progText    = buildProgramSection(program, progStates)
  const perfText    = buildPerformanceSection(sessions)
  const recordsText = buildRecordsSection(records)
  const adviceText  = activeAdvice.length > 0
    ? `**Pending advice**: ${activeAdvice.length} active equipment signal(s).`
   : ''
  const review = program ? db.prepare('SELECT * FROM program_weekly_review WHERE program_id=? ORDER BY week_start DESC LIMIT 1').get(program.id): null
  return `You are WorkoutBuddy, a conversational advisor. You help the user understand
their training, performance, and the algorithmic engine's decisions.
You are not a healthcare professional and do not claim to hold any certification.

RULES:
- Read-only: you cannot create, edit, or configure any application data.
- Never emit an action block, a configuration command, or a promise to make changes.
- Older messages and their action blocks describe an earlier version: ignore their configuration instructions.
- Programs are created through Home > New program, using a questionnaire with predefined choices.
- Settings are configured in Settings and equipment in Exercises and Equipment > Equipment; exclusions are in the exercise library.
- Loads and repetitions are determined by the engine from completed workouts and available equipment.
- Exercises remain stable. A weekly review can temporarily reduce training intensity.
- Explain the available data and acknowledge missing information; do not present a suggestion as an applied decision.
- Reply briefly in French, or in the user's language.
- Do not require conversational onboarding: answer the question even if the profile is incomplete.
- Do not recommend loads beyond the available equipment. Resistance band resistance is approximate.

PROFILE
${profileText}
EQUIPMENT
${equipText}
EXCLUDED EXERCISES
${excludedText}
PROGRAM PREFERENCES
${programPreferences}
PROGRAM AND PROGRESSION
${progText}
LATEST WEEKLY REVIEW
${review ? JSON.stringify({ week_start:review.week_start, decision:review.decision, evidence:JSON.parse(review.evidence) }): 'No review yet.'}
PERFORMANCE
${perfText}
RECORDS
${recordsText}
EQUIPMENT SIGNALS
${adviceText}`
}

// ── Prompt sections ────────────────────────────────────────

function buildProfileSection(profile) {
  if (!profile) return 'Personal profile not provided.'
  return [ profile.display_name ? `First name: ${profile.display_name}`: null,
    profile.sex ? `Sex: ${profile.sex}`: null,
    profile.date_of_birth ? `Date of birth: ${profile.date_of_birth}`: null,
    profile.injury_notes ? `Recorded limitations: ${profile.injury_notes}`: null,
  ].filter(Boolean).join('\n') || 'Personal profile not provided.'
}

function buildEquipmentSection(items, db) {
  if (items.length === 0) return 'No equipment recorded. ⚠️ DO NOT suggest numeric loads without knowing the inventory. A bodyweight program remains possible. Invite the user to physically check what they own at home (bars and their weights, plates by type: weight × count, dumbbells, bench, rack...) and select it in Exercises and Equipment > Equipment (nothing is preselected; they only add what they own). Chat cannot record equipment.'
  const lines = items.map(i => {
    if (i.category === 'resistance_band') return `- ${i.name}: ${i.count} × ${i.resistance_min_kg}–${i.resistance_max_kg} kg nominal resistance (varies with stretch, not a fixed load)`
    if (i.weight_kg && i.count > 1) return `- ${i.name} ${i.weight_kg}kg ×${i.count}`
    if (i.weight_kg) return `- ${i.name} ${i.weight_kg}kg`
    if (i.weight_min_kg) return `- ${i.name} ${i.weight_min_kg}–${i.weight_max_kg}kg (step ${i.weight_step_kg}kg)`
    return `- ${i.name}`
  })
  return lines.join('\n')
}

function buildProgramSection(program, progStates) {
  if (!program) return 'No active program.'
  const lines = [`**${program.name}** (${program.goal}, ${program.level}, ${program.days_per_week} days/week, week ${program.current_week})`]
  if (program.is_in_deload) lines.push('⚠️ DELOAD week in progress')
  if (progStates.length > 0) {
    lines.push('\nExercise progression:')
    for (const s of progStates) {
      const target = s.current_target_reps
        ? `${s.current_weight_kg}kg × ${s.current_target_reps}–${s.target_reps_max}`
       : `${s.current_weight_kg}kg × ${s.target_reps_min}–${s.target_reps_max}`
      const failures = s.consecutive_failures > 0 ? ` (⚠️ ${s.consecutive_failures} failure(s))`: ''
      lines.push(`- ${s.name_fr}: ${target} × ${s.target_sets} sets${failures}`)
    }
  }
  return lines.join('\n')
}

function buildPerformanceSection(sessions) {
  if (sessions.length === 0) return 'No workouts recorded.'
  return sessions.map(s => {
    const dur = s.duration_seconds ? `${Math.round(s.duration_seconds/60)}min`: '?'
    const vol = s.total_volume_kg   ? `${s.total_volume_kg}kg vol.`: ''
    const rpe = s.rpe_avg           ? `Avg. RPE ${s.rpe_avg.toFixed(1)}`: ''
    return `- ${s.scheduled_date}: ${s.name} — ${dur}${vol ? ' / ' + vol: ''}${rpe ? ' / ' + rpe: ''}`
  }).join('\n')
}

function buildRecordsSection(records) {
  if (records.length === 0) return 'No personal records recorded.'
  return records.map(r =>
    `- ${r.name_fr}: ${r.weight_kg}kg × ${r.reps} (estimated 1RM ${r.estimated_1rm_kg}kg) — ${r.achieved_date}`
  ).join('\n')
}
