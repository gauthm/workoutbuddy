export const PROGRAM_MUSCLE_GROUPS = [
  {id:'upper',muscles:['chest','back','shoulders','biceps','triceps','core']},
  {id:'lower',muscles:['quads','hamstrings','glutes','calves']},
]
export const PROGRAM_MUSCLES = PROGRAM_MUSCLE_GROUPS.flatMap(group=>group.muscles)
