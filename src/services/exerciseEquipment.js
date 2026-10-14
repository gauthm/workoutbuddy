// Equipment explicitly required by the imported exercise variant, not optional tips.
const SOURCE_EQUIPMENT = {
  barbell:['barbell'],dumbbell:['dumbbell_fixed'],cable:['cable_machine'],
  'body only':[],bands:['resistance_band'],kettlebells:['kettlebell'],
  'e-z curl bar':['ez_bar'],'exercise ball':['stability_ball'],
  'foam roll':['foam_roller'],'medicine ball':['medicine_ball'],other:[],
}
const EXACT = {
  ab_roller:['ab_wheel'],chair_squat:['chair'],chair_leg_extended_stretch:['chair'],chair_upper_body_stretch:['chair'],chair_lower_back_stretch:['chair'],
  butterfly:['pec_deck'],reverse_machine_flyes:['pec_deck'],ab_crunch_machine:['ab_crunch_machine'],
  dip_machine:['dip_machine'],glute_ham_raise:['glute_ham_bench'],hyperextensions_back_extensions:['hyperextension_bench'],reverse_hyperextension:['hyperextension_bench'],
  hack_squat:['hack_squat'],narrow_stance_hack_squats:['hack_squat'],lying_machine_squat:['hack_squat'],
  leg_press:['leg_press'],narrow_stance_leg_press:['leg_press'],calf_press_on_the_leg_press_machine:['leg_press'],
  leg_extensions:['leg_extension'],single_leg_leg_extension:['leg_extension'],
  lying_leg_curls:['leg_curl'],seated_leg_curl:['leg_curl'],standing_leg_curl:['leg_curl'],
  seated_calf_raise:['calf_machine'],standing_calf_raises:['calf_machine'],calf_press:['calf_machine'],calf_machine_shoulder_shrug:['calf_machine'],
  thigh_abductor:['hip_abductor'],thigh_adductor:['hip_adductor'],
  machine_bench_press:['chest_press'],leverage_chest_press:['chest_press'],leverage_decline_chest_press:['chest_press'],leverage_incline_chest_press:['chest_press'],
  machine_bicep_curl:['biceps_machine'],machine_preacher_curls:['biceps_machine'],machine_triceps_extension:['triceps_machine'],
  machine_shoulder_military_press:['shoulder_press'],leverage_shoulder_press:['shoulder_press'],
  leverage_high_row:['row_machine'],leverage_iso_row:['row_machine'],lying_t_bar_row:['row_machine'],leverage_deadlift:['deadlift_machine'],leverage_shrug:['shrug_machine'],
  lunge_sprint:['smith_machine'],
  bicycling_stationary:['stationary_bike'],recumbent_bike:['stationary_bike'],elliptical_trainer:['elliptical'],
  jogging_treadmill:['treadmill'],running_treadmill:['treadmill'],walking_treadmill:['treadmill'],rowing_stationary:['rowing_machine'],stairmaster:['stair_climber'],step_mill:['stair_climber'],
  bicycling:['bicycle'],skating:['skates'],
  atlas_stones:['atlas_stones'],atlas_stone_trainer:['stone_trainer'],axle_deadlift:['axle_bar'],car_deadlift:['car_deadlift_frame'],
  balance_board:['balance_board'],battling_ropes:['battle_rope'],rope_climb:['climbing_rope'],rope_jumping:['jump_rope'],
  circus_bell:['dumbbell_fixed'],crucifix:['dumbbell_fixed'],conans_wheel:['conans_wheel'],farmers_walk:['farmers_handles'],
  heavy_bag_thrust:['heavy_bag'],keg_load:['keg'],log_lift:['strongman_log'],sandbag_load:['sandbag'],tire_flip:['tire'],
  rickshaw_carry:['rickshaw'],rickshaw_deadlift:['rickshaw'],yoke_walk:['yoke'],
  sledgehammer_swings:['sledgehammer','tire'],wrist_roller:['wrist_roller'],seated_head_harness_neck_resistance:['neck_harness'],
  ring_dips:['gym_rings'],inverted_row_with_straps:['suspension_trainer'],
  bodyweight_mid_row:['barbell','rack'],platform_hamstring_slides:['sliding_discs'],
  front_plate_raise:['plate'],plate_pinch:['plate'],plate_twist:['plate'],reverse_plate_curls:['plate'],standing_olympic_plate_hand_squeeze:['plate'],svend_press:['plate'],
  lying_face_down_plate_neck_resistance:['plate','bench'],lying_face_up_plate_neck_resistance:['plate','bench'],
  chain_handle_extension:['chains'],chain_press:['chains'],
  seated_band_hamstring_curl:['resistance_band'],weighted_sit_ups_with_bands:['resistance_band'],
  weighted_squat:['barbell','rack'],
  front_cone_hops_or_hurdle_hops:['hurdles'],lateral_cone_hops:['cones'],single_cone_sprint_drill:['cones'],hurdle_hops:['hurdles'],
  neck_smr:['massage_ball'],foot_smr:['massage_ball'],anterior_tibialis_smr:['foam_roller'],
  drop_push:['plyo_box'],depth_jump_leap:['plyo_box'],linear_depth_jump:['plyo_box'],single_leg_high_box_squat:['plyo_box'],
  single_leg_push_off:['step_platform'],power_stairs:['step_platform'],stride_jump_crossover:['step_platform'],bench_sprint:['bench'],
  otis_up:['plate'],london_bridges:['climbing_rope'],
}
const PULLUPS = new Set(['pullups','chin_up','gironda_sternum_chins','mixed_grip_chin','one_arm_chin_up','one_handed_hang','side_to_side_chins','kipping_muscle_up','muscle_up','scapular_pull_up','wide_grip_rear_pull_up','rocky_pull_ups_pulldowns'])
const DIPS = new Set(['dips_chest_version','dips_triceps_version','parallel_bar_dip','knee_hip_raise_on_parallel_bars'])

export function requiredExerciseEquipment(exercise, sourceEquipment) {
  const id=exercise.id
  let equipment=EXACT[id] ? [...EXACT[id]] : sourceEquipment in SOURCE_EQUIPMENT
    ? [...SOURCE_EQUIPMENT[sourceEquipment]] : [...(exercise.equipment_required || [])]
  if (id.startsWith('smith_') || id==='decline_smith_press') equipment=['smith_machine']
  if (id.startsWith('suspended_')) equipment=['suspension_trainer']
  if (id.startsWith('sled_') || ['backward_drag','forward_drag_with_press','bear_crawl_sled_drags','prowler_sprint'].includes(id)) equipment=['sled']
  if (id==='sled_drag_harness') equipment.push('sled_harness')
  if (PULLUPS.has(id) || ['weighted_pull_ups','band_assisted_pull_up','v_bar_pullup'].includes(id)) equipment.push('pullup_bar')
  if (id==='band_assisted_pull_up') equipment.push('resistance_band')
  if (id==='weighted_pull_ups') equipment.push('weight_vest')
  if (id==='v_bar_pullup' || id.startsWith('v_bar_')) equipment.push('v_bar_handle')
  if (DIPS.has(id)) equipment.push('dip_station')
  if (id==='trap_bar_deadlift') equipment=['trap_bar']
  if (id.startsWith('landmine_')) equipment=['barbell','landmine']
  if (id.includes('_with_chains')) equipment.push('chains')
  if (id.includes('_with_bands')) equipment.push('resistance_band')
  if (id.includes('bosu_ball')) equipment.push('bosu_ball')
  if (id.includes('medicine_ball')) equipment.push('medicine_ball')
  if (/exercise_ball|stability_ball|physioball|ball_leg_curl|weighted_ball/.test(id)) equipment.push('stability_ball')
  if (id.includes('preacher') && !id.startsWith('machine_')) equipment.push('preacher_bench')
  if (id==='board_press') equipment.push('press_board')
  if (id.startsWith('smith_') && /bench|incline|decline/.test(id) || id==='decline_smith_press') equipment.push(id.includes('decline') ? 'bench_decline' : id.includes('incline') ? 'bench_adjustable' : 'bench')
  if (id.includes('bench') && !id.includes('incline') && !id.includes('decline') && !EXACT[id] && !id.startsWith('machine_') && !id.startsWith('smith_') && !id.includes('hyperextension')) equipment.push('bench')
  if ((id.includes('incline') || id.includes('decline')) && !id.includes('push_up') && !id.includes('cable') && !id.includes('leverage') && !id.startsWith('smith_')) equipment.push(id.includes('decline') ? 'bench_decline' : 'bench_adjustable')
  if (id.startsWith('incline_push_up') || id==='decline_push_up' || id==='push_ups_with_feet_elevated') equipment.push('bench')
  if (/box_jump|box_skip|box_shuffle|box_squat/.test(id)) equipment.push('plyo_box')
  if (id.includes('step_up')) equipment.push('step_platform')
  if (id.includes('pulldown') && !id.includes('straight_arm') && !id.includes('rocky_')) equipment=equipment.filter(category=>category!=='cable_machine').concat('lat_pulldown')
  if (id==='seated_cable_rows') equipment=equipment.filter(category=>category!=='cable_machine').concat('seated_row')
  if (id.includes('cable') && id.includes('rope') || id==='rope_crunch' || id==='triceps_pushdown_rope_attachment') equipment.push('cable_rope')
  const firstInstruction=(exercise.instructions_en || [])[0]?.toLowerCase() || ''
  if (!/without.*bench|no.*bench/.test(firstInstruction)) {
    if (firstInstruction.includes('preacher bench')) equipment.push('preacher_bench')
    else if (firstInstruction.includes('incline bench')) equipment.push('bench_adjustable')
    else if (firstInstruction.includes('decline bench')) equipment.push('bench_decline')
    else if (/flat bench|on a bench|on the bench|on a flat bench/.test(firstInstruction)) equipment.push('bench')
  }
  return [...new Set(equipment)]
}
