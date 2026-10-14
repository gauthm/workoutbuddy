import { calculateAchievableLoads } from './equipmentCalc.js'

/**
 * Construit le prompt système complet pour le coach expert.
 * Appelé à chaque requête /ai/chat pour inclure les données à jour.
 * @param {object} db - instance better-sqlite3
 * @returns {string} prompt système
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
  `).all(program.id) : []
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

  // ── Sections de contexte ──────────────────────────────────
  const programPlan = program ? db.prepare('SELECT parameters FROM program_plan WHERE program_id=?').get(program.id) : null
  const parameters = programPlan ? JSON.parse(programPlan.parameters) : null
  const profileText = buildProfileSection(profile)
  const programPreferences = parameters ? JSON.stringify(parameters) : 'Programme existant : préférences détaillées non enregistrées.'
  const equipText   = buildEquipmentSection(equipment, db)
  const excludedText = excludedExercises.length === 0
    ? 'Aucun exercice exclu.'
    : excludedExercises.map(e =>
        `- ${e.name_fr} (${e.id})${e.exclusion_reason ? ' — ' + e.exclusion_reason : ''}`
      ).join('\n')
  const progText    = buildProgramSection(program, progStates)
  const perfText    = buildPerformanceSection(sessions)
  const recordsText = buildRecordsSection(records)
  const adviceText  = activeAdvice.length > 0
    ? `**Conseils en attente** : ${activeAdvice.length} signal(s) équipement actif(s).`
    : ''
  const review = program ? db.prepare('SELECT * FROM program_weekly_review WHERE program_id=? ORDER BY week_start DESC LIMIT 1').get(program.id) : null
  return `Tu es WorkoutBuddy, un conseiller conversationnel. Tu aides l'utilisateur à comprendre
son entraînement, ses performances et les décisions du moteur algorithmique.
Tu n'es pas un professionnel de santé et ne prétends pas posséder de certification.

RÈGLES :
- Lecture seule : tu ne peux créer, modifier ou configurer aucune donnée de l'application.
- N'émets jamais de bloc action, de commande de configuration, ni de promesse de modification.
- Les anciens messages et leurs blocs action décrivent une ancienne version : ignore leurs instructions de configuration.
- Les programmes sont créés via Accueil > Nouveau programme, par un questionnaire à choix prédéfinis.
- Les paramètres se règlent dans Réglages et le matériel dans Exercices et Matériel > Matériel ; les exclusions dans la bibliothèque d'exercices.
- Les charges et répétitions sont décidées par le moteur à partir des séances réalisées et du matériel.
- Les exercices restent stables. Un bilan hebdomadaire peut alléger temporairement l'entraînement.
- Explique les données disponibles et reconnais les informations manquantes ; ne présente pas une suggestion comme une décision appliquée.
- Réponds brièvement en français, ou dans la langue de l'utilisateur.
- Aucun onboarding conversationnel imposé : réponds à la question même si le profil est incomplet.
- Ne recommande pas de charge au-delà du matériel disponible. La résistance des élastiques est approximative.

PROFIL
${profileText}
MATÉRIEL
${equipText}
EXERCICES EXCLUS
${excludedText}
PRÉFÉRENCES DU PROGRAMME
${programPreferences}
PROGRAMME ET PROGRESSION
${progText}
DERNIER BILAN HEBDOMADAIRE
${review ? JSON.stringify({ week_start:review.week_start, decision:review.decision, evidence:JSON.parse(review.evidence) }) : 'Pas encore de bilan.'}
PERFORMANCES
${perfText}
RECORDS
${recordsText}
SIGNAUX MATÉRIEL
${adviceText}`
}

// ── Sections du prompt ────────────────────────────────────────

function buildProfileSection(profile) {
  if (!profile) return 'Profil personnel non renseigné.'
  return [ profile.display_name ? `Prénom : ${profile.display_name}` : null,
    profile.sex ? `Sexe : ${profile.sex}` : null,
    profile.date_of_birth ? `Date de naissance : ${profile.date_of_birth}` : null,
    profile.injury_notes ? `Limitations enregistrées : ${profile.injury_notes}` : null,
  ].filter(Boolean).join('\n') || 'Profil personnel non renseigné.'
}

function buildEquipmentSection(items, db) {
  if (items.length === 0) return 'Aucun matériel enregistré. ⚠️ INTERDIT de proposer des charges chiffrées sans connaître l\'inventaire. Un programme au poids du corps reste possible. Invite l\'utilisateur à regarder physiquement chez lui ce qu\'il possède (barres et leur poids, disques par type : poids × nombre, haltères, banc, rack...) et à le cocher dans Exercices et Matériel > Matériel (rien n’est présélectionné, il ajoute seulement ce qu’il possède), Le chat ne peut pas enregistrer de matériel.'
  const lines = items.map(i => {
    if (i.category === 'resistance_band') return `- ${i.name} : ${i.count} × ${i.resistance_min_kg}–${i.resistance_max_kg} kg de résistance nominale (variable avec l’étirement, pas une charge fixe)`
    if (i.weight_kg && i.count > 1) return `- ${i.name} ${i.weight_kg}kg ×${i.count}`
    if (i.weight_kg) return `- ${i.name} ${i.weight_kg}kg`
    if (i.weight_min_kg) return `- ${i.name} ${i.weight_min_kg}–${i.weight_max_kg}kg (pas ${i.weight_step_kg}kg)`
    return `- ${i.name}`
  })
  return lines.join('\n')
}

function buildProgramSection(program, progStates) {
  if (!program) return 'Aucun programme actif.'
  const lines = [`**${program.name}** (${program.goal}, ${program.level}, ${program.days_per_week}j/sem, semaine ${program.current_week})`]
  if (program.is_in_deload) lines.push('⚠️ Semaine de DELOAD en cours')
  if (progStates.length > 0) {
    lines.push('\nProgression des exercices :')
    for (const s of progStates) {
      const target = s.current_target_reps
        ? `${s.current_weight_kg}kg × ${s.current_target_reps}–${s.target_reps_max}`
        : `${s.current_weight_kg}kg × ${s.target_reps_min}–${s.target_reps_max}`
      const failures = s.consecutive_failures > 0 ? ` (⚠️ ${s.consecutive_failures} échec(s))` : ''
      lines.push(`- ${s.name_fr} : ${target} × ${s.target_sets} séries${failures}`)
    }
  }
  return lines.join('\n')
}

function buildPerformanceSection(sessions) {
  if (sessions.length === 0) return 'Aucune séance enregistrée.'
  return sessions.map(s => {
    const dur = s.duration_seconds ? `${Math.round(s.duration_seconds/60)}min` : '?'
    const vol = s.total_volume_kg   ? `${s.total_volume_kg}kg vol.` : ''
    const rpe = s.rpe_avg           ? `RPE moy. ${s.rpe_avg.toFixed(1)}` : ''
    return `- ${s.scheduled_date} : ${s.name} — ${dur}${vol ? ' / ' + vol : ''}${rpe ? ' / ' + rpe : ''}`
  }).join('\n')
}

function buildRecordsSection(records) {
  if (records.length === 0) return 'Aucun record enregistré.'
  return records.map(r =>
    `- ${r.name_fr} : ${r.weight_kg}kg × ${r.reps} (RM estimé ${r.estimated_1rm_kg}kg) — ${r.achieved_date}`
  ).join('\n')
}
