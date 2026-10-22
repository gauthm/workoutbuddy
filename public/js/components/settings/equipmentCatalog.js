// Standard equipment catalog for the Settings checklist (T8.4).
// Pure data: reconciliation with equipment_item uses the tag
// 'catalog:<instanceKey>' stored in the notes column.

export const EQUIPMENT_CATALOG = [
  {
    key: 'bars', labelKey: 'settings.equip_group_bars', items: [
      { key: 'barbell',    category: 'barbell', name: 'Straight barbell',
        fields: ['weight','count'], defaults: { weight_kg: 20, count: 1 } },
      { key: 'ez_bar',     category: 'ez_bar',  name: 'EZ bar',
        fields: ['weight','count'], defaults: { weight_kg: 10, count: 1 } },
    ],
  },
  {
    key: 'plates_barbell', labelKey: 'settings.equip_group_plates_bar', items: [
      // One row per plate type: both unit weight and count are editable
      { key: 'plate_1.25', category: 'plate', name: 'Plate 1,25 kg',
        fields: ['weight','count'], defaults: { weight_kg: 1.25, count: 4 } },
      { key: 'plate_2.5',  category: 'plate', name: 'Plate 2,5 kg',
        fields: ['weight','count'], defaults: { weight_kg: 2.5,  count: 4 } },
      { key: 'plate_5',    category: 'plate', name: 'Plate 5 kg',
        fields: ['weight','count'], defaults: { weight_kg: 5,    count: 4 } },
      { key: 'plate_10',   category: 'plate', name: 'Plate 10 kg',
        fields: ['weight','count'], defaults: { weight_kg: 10,   count: 4 } },
      { key: 'plate_15',   category: 'plate', name: 'Plate 15 kg',
        fields: ['weight','count'], defaults: { weight_kg: 15,   count: 2 } },
      { key: 'plate_20',   category: 'plate', name: 'Plate 20 kg',
        fields: ['weight','count'], defaults: { weight_kg: 20,   count: 4 } },
      { key: 'plate_25',   category: 'plate', name: 'Plate 25 kg',
        fields: ['weight','count'], defaults: { weight_kg: 25,   count: 2 } },
    ],
  },
  {
    key: 'plates_dumbbell', labelKey: 'settings.equip_group_plates_db', items: [
      { key: 'db_plate_1',   category: 'dumbbell_plate', name: 'Dumbbell plate 1 kg',
        fields: ['weight','count'], defaults: { weight_kg: 1,   count: 4 } },
      { key: 'db_plate_1.5', category: 'dumbbell_plate', name: 'Dumbbell plate 1,5 kg',
        fields: ['weight','count'], defaults: { weight_kg: 1.5, count: 4 } },
      { key: 'db_plate_2.5', category: 'dumbbell_plate', name: 'Dumbbell plate 2,5 kg',
        fields: ['weight','count'], defaults: { weight_kg: 2.5, count: 4 } },
      { key: 'db_plate_5',   category: 'dumbbell_plate', name: 'Dumbbell plate 5 kg',
        fields: ['weight','count'], defaults: { weight_kg: 5,   count: 4 } },
    ],
  },
  {
    key: 'dumbbells', labelKey: 'settings.equip_group_dumbbells', items: [
      { key: 'dumbbell_fixed', category: 'dumbbell_fixed',
        name: 'Pair of fixed dumbbells', perPair: true, repeatable: true,
        fields: ['weight','count'], defaults: { weight_kg: 10, count: 2 } },
      { key: 'dumbbell_adjustable', category: 'dumbbell_adjustable',
        name: 'Selectorized adjustable dumbbells', perPair: true,
        fields: ['range','count'],
        defaults: { weight_min_kg: 2, weight_max_kg: 24, weight_step_kg: 2, count: 2 } },
      { key: 'dumbbell_loadable', category: 'dumbbell_loadable',
        name: 'Pair of plate-loaded dumbbells (handles)', perPair: true,
        fields: ['weight','count'], defaults: { weight_kg: 2.5, count: 2 } },
    ],
  },
  {
    key: 'kettlebells_bands', labelKey: 'settings.equip_group_kb_bands', items: [
      { key: 'kettlebell', category: 'kettlebell', name: 'Kettlebell',
        fields: ['weight','count'], defaults: { weight_kg: 16, count: 1 } },
      { key: 'resistance_band', category: 'resistance_band', name: 'Resistance band',
        fields: ['range','count'],
        defaults: { resistance_min_kg: 5, resistance_max_kg: 30, count: 1 } },
    ],
  },
  {
    key: 'benches', labelKey: 'settings.equip_group_benches', items: [
      { key: 'bench',            category: 'bench',            name: 'Flat bench',       fields: [], defaults: {} },
      { key: 'bench_adjustable', category: 'bench_adjustable', name: 'Adjustable bench', fields: [], defaults: {} },
    ],
  },
  {
    key: 'structures', labelKey: 'settings.equip_group_structures', items: [
      { key: 'roman_chair', category: 'roman_chair', name: 'Power tower', fields: [], defaults: {} },
      { key: 'rack',          category: 'rack',          name: 'Rack / cage',        fields: [], defaults: {} },
      { key: 'pullup_bar',    category: 'pullup_bar',    name: 'Pull-up bar',  fields: [], defaults: {} },
      { key: 'cable_machine', category: 'cable_machine', name: 'Cable machine',     fields: [], defaults: {} },
      { key: 'smith_machine', category: 'smith_machine', name: 'Smith machine',      fields: [], defaults: {} },
    ],
  },
]
