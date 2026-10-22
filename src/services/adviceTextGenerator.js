import { streamChat } from './aiProvider.js'
import { getAiSettings } from '../routes/settings.js'

// Prompts by signal type
const ADVICE_PROMPTS = {
  equipment_limit_approaching: d => `The user is approaching the equipment limit for ${d.exercise_name_fr}. Current load ${d.current_weight_kg} kg, maximum ${d.max_load_kg} kg. ${d.resistance_is_approximate ? 'Resistance bands: nominal resistance varies with stretch; no precise date can be given.': `Estimate: about ${d.estimated_sessions} workouts if recent progression continues; an uncertain estimate, not a guarantee.`} Required equipment: ${JSON.stringify(d.equipment_required)}. Write concise advice in French to plan an equipment-appropriate purchase, with a free alternative, without inventing prices or dates.`,
  max_load_reached: (d) => `
Signal detected in WorkoutBuddy :
- Exercise: ${d.exercise_name_fr}
- Equipment: ${JSON.stringify(d.equipment_required || [])}
- Approximate resistance: ${!!d.resistance_is_approximate}
- Maximum load achievable with current equipment: ${d.max_load_kg} kg
- Over ${d.sessions_checked} consecutive workouts: ${d.actual_reps_avg} reps on average (maximum target: ${d.target_reps_max})

As an expert coach, write concise advice (4-6 sentences) :
1. Explain the problem precisely (cite the numbers)
2. Which equipment to buy and why (no brands, with a EUR price range)
3. What this will concretely enable for progression
4. A free or creative alternative if possible
Reply in French.`,

  min_increment_too_large: (d) => `
Signal detected in WorkoutBuddy :
- Exercise: ${d.exercise_name_fr}
- Equipment: ${JSON.stringify(d.equipment_required || [])}
- Approximate resistance: ${!!d.resistance_is_approximate}
- Current load: ${d.current_weight_kg} kg
- Smallest possible increment: ${d.min_increment_kg} kg (${d.pct}% of the current load)
- Plateau confirmed over recent workouts

Write coaching advice (4-6 sentences) on progressing when the minimum increment is too large :
- Equipment suited to the category: microplates for barbells/plate-loaded dumbbells; an intermediate kettlebell for kettlebells; do not suggest microplates for resistance bands
- Alternative techniques (rest-pause, drop sets, eccentric emphasis)
- Reorganizing training to work around this problem
Reply in French.`,

  no_exercise_available: (d) => `
Signal detected in WorkoutBuddy :
- Muscle group: ${d.muscle_group}
- No strength exercise is feasible for this muscle with the current equipment

Write coaching advice (4-6 sentences) :
1. Why training this muscle matters
2. Which minimum equipment to buy to enable exercises (EUR prices)
3. Alternatives with current equipment if any exist (bodyweight exercises, resistance bands)
Reply in French.`,

  no_rotation_possible: (d) => `
Signal detected in WorkoutBuddy :
- Exercise: ${d.exercise_name_fr}
- Equipment: ${JSON.stringify(d.equipment_required || [])}
- Approximate resistance: ${!!d.resistance_is_approximate} (rotation group: ${d.rotation_group})
- Cannot vary the exercise — no equivalent movement is feasible with current equipment

Write coaching advice (3-5 sentences) :
1. Why varying exercises is beneficial (breaks plateaus, prevents injuries)
2. Which equipment would allow more variations (EUR prices)
3. A suggested free variation if possible
Reply in French.`,

  persistent_plateau: (d) => `
Signal detected in WorkoutBuddy :
- Exercise: ${d.exercise_name_fr}
- Equipment: ${JSON.stringify(d.equipment_required || [])}
- Approximate resistance: ${!!d.resistance_is_approximate}
- Persistent plateau over ${d.sessions_checked} workouts (delta: ${d.delta_pct}%)
- Current load: ${d.current_weight_kg} kg
- Smallest available increment: ${d.min_increment_kg} kg

Write expert coaching advice (5-7 sentences) to break through this plateau :
- Analyze causes (increment too large, insufficient volume, recovery)
- Technical solutions (microplates, program change, variation)
- Recommended equipment if this is an equipment problem (EUR prices)
- Recommended immediate action
Reply in French.`,

  high_fatigue: (d) => `
Signal detected in WorkoutBuddy :
- Average RPE over the last ${d.sets_analyzed} sets: ${d.avg_rpe}/10
- Alert threshold: 8.5/10

As an expert fitness coach, write recovery advice (4-6 sentences) :
1. Interpret the high RPE (overtraining? progression too fast?)
2. Recommended immediate actions (deload? rest? volume adjustment?)
3. Indicators to monitor
4. Long-term prevention
Reply in French.`,
}

/**
 * Generate LLM text for advice entries without text.
 * Limit to 5 generations per call to avoid blocking.
 */
export async function generatePendingAdviceTexts(db) {
  const aiSettings = getAiSettings(db)
  if (!aiSettings.base_url || !aiSettings.model) return 0

  const pending = db.prepare(`
    SELECT * FROM equipment_advice
    WHERE status='active' AND (advice_text IS NULL OR advice_text='')
    ORDER BY created_at ASC LIMIT 5
  `).all()

  let generated = 0
  for (const advice of pending) {
    try {
      const signalData = JSON.parse(advice.signal_data || '{}')
      const promptFn   = ADVICE_PROMPTS[advice.signal_type]
      if (!promptFn) continue

      const prompt   = promptFn(signalData)
      const messages = [{ role: 'user', content: prompt }]

      let text = ''
      for await (const event of streamChat(messages, aiSettings)) {
        if (event.type === 'token') text += event.content
        if (event.type === 'error' || event.type === 'done') break
      }

      if (text.trim()) {
        db.prepare("UPDATE equipment_advice SET advice_text=?,last_generated_at=datetime('now') WHERE id=?").run(text.trim(), advice.id)
        generated++
      }
    } catch (err) {
      console.warn(`[adviceText] advice ${advice.id}:`, err.message)
    }
  }
  return generated
}
