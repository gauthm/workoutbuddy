// Shared inventory choices; nothing is owned until the user selects or adds it.
export const SIMPLE_CATEGORIES = [
  'bench','bench_adjustable','bench_decline','preacher_bench','hyperextension_bench','glute_ham_bench',
  'rack','pullup_bar','roman_chair','dip_station','gym_mat','ab_wheel','chair','step_platform','plyo_box',
  'stability_ball','medicine_ball','bosu_ball','foam_roller','massage_ball','suspension_trainer','gym_rings',
  'jump_rope','battle_rope','climbing_rope','balance_board','sliding_discs','cones','hurdles',
  'cable_machine','smith_machine','leg_press','leg_extension','leg_curl','lat_pulldown','seated_row',
  'chest_press','shoulder_press','pec_deck','calf_machine','hack_squat','hip_abductor','hip_adductor',
  'biceps_machine','triceps_machine','ab_crunch_machine','dip_machine','row_machine','deadlift_machine','shrug_machine',
  'treadmill','stationary_bike','elliptical','rowing_machine','stair_climber',
  'landmine','trap_bar','axle_bar','chains','weight_vest','neck_harness','wrist_roller','cable_rope','v_bar_handle',
  'sled','sled_harness','sandbag','tire','sledgehammer','heavy_bag','atlas_stones','stone_trainer','strongman_log',
  'keg','yoke','farmers_handles','rickshaw','conans_wheel','car_deadlift_frame','press_board','bicycle','skates'
]
export const ALL_EQUIPMENT_CATEGORIES = [
  'barbell','ez_bar','plate','dumbbell_plate','dumbbell_fixed','dumbbell_adjustable','dumbbell_loadable',
  'kettlebell','resistance_band',...SIMPLE_CATEGORIES,'other'
]

// One partition shared by inventory presentation and exercise filters.
export const EQUIPMENT_FAMILIES = [
  { id: 'free_weights', categories: ['barbell','ez_bar','plate','dumbbell_plate','dumbbell_fixed','dumbbell_adjustable','dumbbell_loadable','kettlebell','trap_bar','axle_bar','landmine'] },
  { id: 'benches', categories: ['bench','bench_adjustable','bench_decline','preacher_bench','hyperextension_bench','glute_ham_bench','rack','chair','step_platform','plyo_box'] },
  { id: 'pullups', categories: ['pullup_bar','roman_chair','dip_station','gym_rings','suspension_trainer','climbing_rope'] },
  { id: 'accessories', categories: ['resistance_band','gym_mat','ab_wheel','stability_ball','medicine_ball','bosu_ball','foam_roller','massage_ball','balance_board','sliding_discs','cones','hurdles','chains','weight_vest','neck_harness','wrist_roller','cable_rope','v_bar_handle','press_board'] },
  { id: 'machines', categories: ['cable_machine','smith_machine','leg_press','leg_extension','leg_curl','lat_pulldown','seated_row','chest_press','shoulder_press','pec_deck','calf_machine','hack_squat','hip_abductor','hip_adductor','biceps_machine','triceps_machine','ab_crunch_machine','dip_machine','row_machine','deadlift_machine','shrug_machine'] },
  { id: 'cardio', categories: ['treadmill','stationary_bike','elliptical','rowing_machine','stair_climber','jump_rope','battle_rope','bicycle','skates'] },
  { id: 'specialized', categories: ['sled','sled_harness','sandbag','tire','sledgehammer','heavy_bag','atlas_stones','stone_trainer','strongman_log','keg','yoke','farmers_handles','rickshaw','conans_wheel','car_deadlift_frame'] },
  { id: 'custom', categories: ['other'] },
]
