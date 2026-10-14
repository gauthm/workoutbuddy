// Conservative generation pool: the imported catalog sometimes omits equipment.
// Custom exercises use the user's explicit metadata. The full library remains available.
const groups = [
  [[], ['pushups','pushups_close_and_wide_hand_positions','bodyweight_squat','bodyweight_walking_lunge','butt_lift_bridge','single_leg_glute_bridge','crunches','reverse_crunch','bent_knee_hip_raise','hyperextensions_with_no_hyperextension_bench']],
  [['bench'], ['incline_push_up','decline_push_up']],
  [['pullup_bar'], ['pullups','chin_up']],
  [['pullup_bar','resistance_band'], ['band_assisted_pull_up']],
  [['barbell','bench'], ['barbell_bench_press_medium_grip']],
  [['barbell','bench_adjustable'], ['barbell_incline_bench_press_medium_grip']],
  [['barbell','rack'], ['barbell_squat']],
  [['barbell'], ['barbell_deadlift','romanian_deadlift','bent_over_barbell_row','barbell_shoulder_press','barbell_curl','barbell_glute_bridge']],
  [['dumbbell_fixed'], ['goblet_squat','dumbbell_lunges','dumbbell_rear_lunge','bent_over_two_dumbbell_row','dumbbell_one_arm_shoulder_press','dumbbell_bicep_curl','alternate_hammer_curl','side_lateral_raise','dumbbell_one_arm_triceps_extension']],
  [['dumbbell_fixed','bench'], ['dumbbell_bench_press','one_arm_dumbbell_row','dumbbell_shoulder_press']],
  [['dumbbell_fixed','bench_adjustable'], ['incline_dumbbell_press']],
  [['kettlebell'], ['kettlebell_deadlift','kettlebell_sumo_high_pull','kettlebell_one_arm_row','kettlebell_one_arm_military_press']],
  [['resistance_band'], ['band_good_morning','back_flyes_with_bands','band_pull_apart','cross_over_with_bands','shoulder_press_with_bands','lateral_raise_with_bands','band_skull_crusher','hip_extension_with_bands','calf_raises_with_bands']],
  [['cable_machine'], ['seated_cable_rows','wide_grip_lat_pulldown','close_grip_front_lat_pulldown','cable_chest_press','cable_shoulder_press','triceps_pushdown','triceps_pushdown_rope_attachment','standing_biceps_cable_curl']],
  [['leg_press'], ['leg_press']],
  [['leg_extension'], ['leg_extensions']],
  [['leg_curl'], ['lying_leg_curls','seated_leg_curl']],
  [['chest_press'], ['machine_bench_press']],
  [['shoulder_press'], ['leverage_shoulder_press']],
  [['calf_machine'], ['seated_calf_raise']],
  [['dip_station'], ['dips_triceps_version']],
]
const catalog = new Map(groups.flatMap(([equipment,ids]) => ids.map(id => [id,equipment])))
const technical = new Set(['barbell_squat','barbell_deadlift','romanian_deadlift','pullups','chin_up','dips_triceps_version'])

export function generationCandidate(exercise, level) {
  if (exercise.is_custom) return exercise
  if (!catalog.has(exercise.id) || level === 'beginner' && technical.has(exercise.id)) return null
  const verified = (exercise.equipment_required || []).some(c=>['lat_pulldown','seated_row'].includes(c)) ? exercise.equipment_required : catalog.get(exercise.id)
  // Machine-specific requirements replace the importer's generic cable-machine mapping.
  const machine = verified.some(c => ['leg_press','leg_extension','leg_curl','chest_press','shoulder_press','calf_machine'].includes(c))
  return { ...exercise, equipment_required:machine ? verified : [...new Set([...(exercise.equipment_required || []),...verified])] }
}
