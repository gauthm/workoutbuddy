import { streamChat } from './aiProvider.js'
import { getAiSettings } from '../routes/settings.js'

// Prompts par type de signal
const ADVICE_PROMPTS = {
  equipment_limit_approaching: d => `L’utilisateur approche de la limite de son matériel pour ${d.exercise_name_fr}. Charge actuelle ${d.current_weight_kg} kg, plafond ${d.max_load_kg} kg. ${d.resistance_is_approximate ? 'Élastiques : résistance nominale variable avec l’étirement, aucune date précise possible.' : `Estimation : environ ${d.estimated_sessions} séances si la progression récente continue ; estimation incertaine, pas une garantie.`} Matériel requis : ${JSON.stringify(d.equipment_required)}. Rédige en français un conseil concis pour anticiper un achat adapté au matériel, avec une alternative gratuite, sans inventer de prix ni de date.`,
  max_load_reached: (d) => `
Signal détecté dans WorkoutBuddy :
- Exercice : ${d.exercise_name_fr}
- Matériel : ${JSON.stringify(d.equipment_required || [])}
- Résistance approximative : ${!!d.resistance_is_approximate}
- Charge maximale atteignable avec l'équipement actuel : ${d.max_load_kg} kg
- Depuis ${d.sessions_checked} séances consécutives : ${d.actual_reps_avg} reps en moyenne (objectif max : ${d.target_reps_max})

En tant que coach expert, rédige un conseil concis (4-6 phrases) :
1. Explique le problème précisément (cite les chiffres)
2. Quel matériel acheter et pourquoi (sans marque, avec fourchette de prix EUR)
3. Ce que ça débloquera concrètement pour la progression
4. Une alternative gratuite ou créative si possible
Réponds en français.`,

  min_increment_too_large: (d) => `
Signal détecté dans WorkoutBuddy :
- Exercice : ${d.exercise_name_fr}
- Matériel : ${JSON.stringify(d.equipment_required || [])}
- Résistance approximative : ${!!d.resistance_is_approximate}
- Charge actuelle : ${d.current_weight_kg} kg
- Plus petit incrément possible : ${d.min_increment_kg} kg (${d.pct}% de la charge courante)
- Plateau confirmé sur les dernières séances

Rédige un conseil de coach (4-6 phrases) sur comment progresser quand l'incrément minimal est trop grand :
- Matériel adapté à la catégorie : micro-disques pour barres/haltères à disques ; kettlebell intermédiaire pour kettlebells ; ne pas proposer de micro-disques pour les élastiques
- Techniques alternatives (rest-pause, drop-sets, accentuation excentrique)
- Réorganisation de l'entraînement pour contourner ce problème
Réponds en français.`,

  no_exercise_available: (d) => `
Signal détecté dans WorkoutBuddy :
- Groupe musculaire : ${d.muscle_group}
- Aucun exercice de force n'est réalisable avec l'équipement actuel pour ce muscle

Rédige un conseil de coach (4-6 phrases) :
1. Pourquoi travailler ce muscle est important
2. Quel équipement minimal acheter pour débloquer des exercices (prix EUR)
3. Des alternatives avec le matériel actuel si elles existent (exercices au poids du corps, élastiques)
Réponds en français.`,

  no_rotation_possible: (d) => `
Signal détecté dans WorkoutBuddy :
- Exercice : ${d.exercise_name_fr}
- Matériel : ${JSON.stringify(d.equipment_required || [])}
- Résistance approximative : ${!!d.resistance_is_approximate} (groupe de rotation : ${d.rotation_group})
- Impossible de varier l'exercice — aucun mouvement équivalent réalisable avec l'équipement actuel

Rédige un conseil de coach (3-5 phrases) :
1. Pourquoi varier les exercices est bénéfique (brise les plateaux, prévient les blessures)
2. Quel matériel permettrait d'ajouter des variantes (prix EUR)
3. Une suggestion de variante gratuite si possible
Réponds en français.`,

  persistent_plateau: (d) => `
Signal détecté dans WorkoutBuddy :
- Exercice : ${d.exercise_name_fr}
- Matériel : ${JSON.stringify(d.equipment_required || [])}
- Résistance approximative : ${!!d.resistance_is_approximate}
- Plateau persistant sur ${d.sessions_checked} séances (delta : ${d.delta_pct}%)
- Charge actuelle : ${d.current_weight_kg} kg
- Plus petit incrément disponible : ${d.min_increment_kg} kg

Rédige un conseil de coach expert (5-7 phrases) pour débloquer ce plateau :
- Analyse des causes (incrément trop grand, volume insuffisant, récupération)
- Solutions techniques (micro-plaques, changement de programme, variation)
- Matériel recommandé si c'est un problème d'équipement (prix EUR)
- Recommandation d'action immédiate
Réponds en français.`,

  high_fatigue: (d) => `
Signal détecté dans WorkoutBuddy :
- RPE moyen des ${d.sets_analyzed} dernières séries : ${d.avg_rpe}/10
- Seuil d'alerte : 8.5/10

En tant que coach sportif expert, rédige un conseil de récupération (4-6 phrases) :
1. Interprétation du RPE élevé (surentraînement ? progression trop rapide ?)
2. Actions immédiates recommandées (déload ? repos ? ajustement volume)
3. Indicateurs à surveiller
4. Prévention long terme
Réponds en français.`,
}

/**
 * Génère les textes LLM pour les advice sans texte.
 * Maximum 5 générations par appel pour ne pas bloquer.
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
