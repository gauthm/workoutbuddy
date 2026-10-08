import { calculateAchievableLoads, roundDownToAchievable } from './equipmentCalc.js'

/**
 * Table de suggestion premier essai.
 * [goal][level][mechanic] = { pct: % du poids de corps, reps: répétitions suggérées }
 * pct = 0 pour les exercices au poids de corps (pas de charge externe)
 */
const FIRST_TIME_TABLE = {
  strength: {
    beginner:     { compound: { pct: 0.30, reps: 5  }, isolation: { pct: 0.12, reps: 8  } },
    intermediate: { compound: { pct: 0.50, reps: 5  }, isolation: { pct: 0.20, reps: 8  } },
    advanced:     { compound: { pct: 0.65, reps: 5  }, isolation: { pct: 0.28, reps: 8  } },
    athlete:      { compound: { pct: 0.80, reps: 3  }, isolation: { pct: 0.35, reps: 6  } },
  },
  hypertrophy: {
    beginner:     { compound: { pct: 0.25, reps: 10 }, isolation: { pct: 0.10, reps: 12 } },
    intermediate: { compound: { pct: 0.40, reps: 10 }, isolation: { pct: 0.18, reps: 12 } },
    advanced:     { compound: { pct: 0.55, reps: 8  }, isolation: { pct: 0.25, reps: 12 } },
    athlete:      { compound: { pct: 0.70, reps: 8  }, isolation: { pct: 0.30, reps: 10 } },
  },
  endurance: {
    beginner:     { compound: { pct: 0.20, reps: 15 }, isolation: { pct: 0.08, reps: 15 } },
    intermediate: { compound: { pct: 0.30, reps: 15 }, isolation: { pct: 0.15, reps: 15 } },
    advanced:     { compound: { pct: 0.40, reps: 15 }, isolation: { pct: 0.20, reps: 15 } },
    athlete:      { compound: { pct: 0.50, reps: 12 }, isolation: { pct: 0.25, reps: 12 } },
  },
  weight_loss: {
    beginner:     { compound: { pct: 0.22, reps: 12 }, isolation: { pct: 0.09, reps: 15 } },
    intermediate: { compound: { pct: 0.35, reps: 12 }, isolation: { pct: 0.15, reps: 15 } },
    advanced:     { compound: { pct: 0.48, reps: 12 }, isolation: { pct: 0.20, reps: 12 } },
    athlete:      { compound: { pct: 0.55, reps: 12 }, isolation: { pct: 0.25, reps: 12 } },
  },
  general_fitness: {
    beginner:     { compound: { pct: 0.25, reps: 10 }, isolation: { pct: 0.10, reps: 12 } },
    intermediate: { compound: { pct: 0.38, reps: 10 }, isolation: { pct: 0.16, reps: 12 } },
    advanced:     { compound: { pct: 0.50, reps: 10 }, isolation: { pct: 0.22, reps: 12 } },
    athlete:      { compound: { pct: 0.60, reps: 10 }, isolation: { pct: 0.28, reps: 10 } },
  },
  sport_performance: {
    beginner:     { compound: { pct: 0.35, reps: 6  }, isolation: { pct: 0.15, reps: 10 } },
    intermediate: { compound: { pct: 0.55, reps: 5  }, isolation: { pct: 0.22, reps: 8  } },
    advanced:     { compound: { pct: 0.70, reps: 4  }, isolation: { pct: 0.30, reps: 8  } },
    athlete:      { compound: { pct: 0.85, reps: 3  }, isolation: { pct: 0.38, reps: 6  } },
  },
}

// Reps pour exercices au poids du corps (pas de charge externe)
const BODYWEIGHT_REPS = {
  strength:         { beginner: 3,  intermediate: 5,  advanced: 8,  athlete: 12 },
  hypertrophy:      { beginner: 5,  intermediate: 8,  advanced: 12, athlete: 15 },
  endurance:        { beginner: 10, intermediate: 15, advanced: 20, athlete: 25 },
  weight_loss:      { beginner: 8,  intermediate: 12, advanced: 15, athlete: 20 },
  general_fitness:  { beginner: 6,  intermediate: 10, advanced: 15, athlete: 20 },
  sport_performance:{ beginner: 5,  intermediate: 8,  advanced: 12, athlete: 15 },
}

/**
 * Calcule la suggestion de poids et reps pour un exercice effectué pour la première fois.
 *
 * Algorithme DÉTERMINISTE — aucun appel LLM.
 *
 * @param {object} exercise      - { id, mechanic, equipment_required, is_unilateral }
 * @param {object} userProfile   - { weight_kg, fitness_level, primary_goal }
 * @param {object} templateExercise - { target_reps_min, target_reps_max }
 * @param {object[]} equipmentItems - inventaire complet
 * @returns {{
 *   weight_kg: number,
 *   reps: number,
 *   reasoning: string     // texte affiché dans la bulle
 * }}
 */
export function suggestFirstTime(exercise, userProfile, templateExercise, equipmentItems) {
  const bodyweightKg = userProfile?.weight_kg || 70
  const level        = userProfile?.fitness_level || 'beginner'
  const goal         = userProfile?.primary_goal  || 'general_fitness'
  const mechanic     = exercise.mechanic === 'compound' ? 'compound' : 'isolation'

  // ── Exercice sans charge externe (poids du corps) ───────────
  const isBodyweight = !exercise.equipment_required ||
                       exercise.equipment_required.length === 0

  if (isBodyweight) {
    const reps = (BODYWEIGHT_REPS[goal] || BODYWEIGHT_REPS.general_fitness)[level] || 8
    // Utiliser les reps de la fourchette du template si disponibles
    const templateReps = templateExercise?.target_reps_min || reps
    return {
      weight_kg: 0,
      reps:      templateReps,
      reasoning: buildReasoning(goal, level, mechanic, 0, templateReps, bodyweightKg, true),
    }
  }

  // ── Exercice avec charge ─────────────────────────────────────
  const table = (FIRST_TIME_TABLE[goal] || FIRST_TIME_TABLE.general_fitness)[level]
  const config = table?.[mechanic] || { pct: 0.25, reps: 10 }

  const rawWeight   = bodyweightKg * config.pct
  const loadsResult = calculateAchievableLoads(equipmentItems, exercise)

  let weight
  if (loadsResult.loads_kg.length === 0) {
    // Aucune charge disponible (matériel manquant)
    weight = 0
  } else {
    weight = roundDownToAchievable(rawWeight, loadsResult.loads_kg)
    // Si la charge suggérée est la charge minimale, l'utiliser quand même
    if (weight <= 0) weight = loadsResult.loads_kg[0]
  }

  // Utiliser les reps de la fourchette du template si disponibles
  const reps = templateExercise?.target_reps_min || config.reps

  return {
    weight_kg: weight,
    reps,
    reasoning: buildReasoning(goal, level, mechanic, weight, reps, bodyweightKg, false),
  }
}

/**
 * Construit le texte d'explication pour la bulle.
 */
function buildReasoning(goal, level, mechanic, weightKg, reps, bodyweightKg, isBodyweight) {
  const goalLabels = {
    strength: 'force', hypertrophy: 'hypertrophie', endurance: 'endurance',
    weight_loss: 'perte de poids', general_fitness: 'forme générale',
    sport_performance: 'performance sportive',
  }
  const levelLabels = {
    beginner: 'débutant', intermediate: 'intermédiaire',
    advanced: 'avancé', athlete: 'athlète',
  }
  const mechanicLabel = mechanic === 'compound' ? 'composé' : 'isolation'

  if (isBodyweight) {
    return `Premier essai · Niveau ${levelLabels[level] || level}, objectif ${goalLabels[goal] || goal}. ` +
           `Exercice au poids du corps : commencez avec ${reps} répétitions propres. ` +
           `Ajustez selon votre ressenti.`
  }

  const pct = Math.round((weightKg / bodyweightKg) * 100)
  return `Premier essai · Niveau ${levelLabels[level] || level}, objectif ${goalLabels[goal] || goal}. ` +
         `Exercice ${mechanicLabel} : ${weightKg} kg (≈ ${pct}% de votre poids de corps) × ${reps} reps. ` +
         `C'est une charge prudente pour trouver votre niveau — ajustez à votre ressenti.`
}
