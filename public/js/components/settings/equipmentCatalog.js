// Catalogue de matériel standard pour la checklist des Paramètres (T8.4).
// Données pures — la réconciliation avec equipment_item se fait via le tag
// 'catalog:<instanceKey>' stocké dans la colonne notes.

export const EQUIPMENT_CATALOG = [
  {
    key: 'bars', labelKey: 'settings.equip_group_bars', items: [
      { key: 'barbell',    category: 'barbell', name: 'Barre droite',
        fields: ['weight','count'], defaults: { weight_kg: 20, count: 1 } },
      { key: 'ez_bar',     category: 'ez_bar',  name: 'Barre EZ',
        fields: ['weight','count'], defaults: { weight_kg: 10, count: 1 } },
    ],
  },
  {
    key: 'plates_barbell', labelKey: 'settings.equip_group_plates_bar', items: [
      // Une ligne par type de disque — poids unitaire ET nombre éditables
      { key: 'plate_1.25', category: 'plate', name: 'Disque 1,25 kg',
        fields: ['weight','count'], defaults: { weight_kg: 1.25, count: 4 } },
      { key: 'plate_2.5',  category: 'plate', name: 'Disque 2,5 kg',
        fields: ['weight','count'], defaults: { weight_kg: 2.5,  count: 4 } },
      { key: 'plate_5',    category: 'plate', name: 'Disque 5 kg',
        fields: ['weight','count'], defaults: { weight_kg: 5,    count: 4 } },
      { key: 'plate_10',   category: 'plate', name: 'Disque 10 kg',
        fields: ['weight','count'], defaults: { weight_kg: 10,   count: 4 } },
      { key: 'plate_15',   category: 'plate', name: 'Disque 15 kg',
        fields: ['weight','count'], defaults: { weight_kg: 15,   count: 2 } },
      { key: 'plate_20',   category: 'plate', name: 'Disque 20 kg',
        fields: ['weight','count'], defaults: { weight_kg: 20,   count: 4 } },
      { key: 'plate_25',   category: 'plate', name: 'Disque 25 kg',
        fields: ['weight','count'], defaults: { weight_kg: 25,   count: 2 } },
    ],
  },
  {
    key: 'plates_dumbbell', labelKey: 'settings.equip_group_plates_db', items: [
      { key: 'db_plate_1',   category: 'dumbbell_plate', name: 'Disque haltère 1 kg',
        fields: ['weight','count'], defaults: { weight_kg: 1,   count: 4 } },
      { key: 'db_plate_1.5', category: 'dumbbell_plate', name: 'Disque haltère 1,5 kg',
        fields: ['weight','count'], defaults: { weight_kg: 1.5, count: 4 } },
      { key: 'db_plate_2.5', category: 'dumbbell_plate', name: 'Disque haltère 2,5 kg',
        fields: ['weight','count'], defaults: { weight_kg: 2.5, count: 4 } },
      { key: 'db_plate_5',   category: 'dumbbell_plate', name: 'Disque haltère 5 kg',
        fields: ['weight','count'], defaults: { weight_kg: 5,   count: 4 } },
    ],
  },
  {
    key: 'dumbbells', labelKey: 'settings.equip_group_dumbbells', items: [
      { key: 'dumbbell_fixed', category: 'dumbbell_fixed',
        name: 'Paire d\'haltères fixes', perPair: true, repeatable: true,
        fields: ['weight','count'], defaults: { weight_kg: 10, count: 2 } },
      { key: 'dumbbell_adjustable', category: 'dumbbell_adjustable',
        name: 'Haltères réglables (sélecteur)', perPair: true,
        fields: ['range','count'],
        defaults: { weight_min_kg: 2, weight_max_kg: 24, weight_step_kg: 2, count: 2 } },
      { key: 'dumbbell_loadable', category: 'dumbbell_loadable',
        name: 'Paire d\'haltères à disques (poignée)', perPair: true,
        fields: ['weight','count'], defaults: { weight_kg: 2.5, count: 2 } },
    ],
  },
  {
    key: 'kettlebells_bands', labelKey: 'settings.equip_group_kb_bands', items: [
      { key: 'kettlebell', category: 'kettlebell', name: 'Kettlebell',
        fields: ['weight','count'], defaults: { weight_kg: 16, count: 1 } },
      { key: 'resistance_band', category: 'resistance_band', name: 'Élastique',
        fields: ['range','count'],
        defaults: { resistance_min_kg: 5, resistance_max_kg: 30, count: 1 } },
    ],
  },
  {
    key: 'benches', labelKey: 'settings.equip_group_benches', items: [
      { key: 'bench',            category: 'bench',            name: 'Banc plat',       fields: [], defaults: {} },
      { key: 'bench_adjustable', category: 'bench_adjustable', name: 'Banc inclinable', fields: [], defaults: {} },
    ],
  },
  {
    key: 'structures', labelKey: 'settings.equip_group_structures', items: [
      { key: 'rack',          category: 'rack',          name: 'Rack / Cage',        fields: [], defaults: {} },
      { key: 'pullup_bar',    category: 'pullup_bar',    name: 'Barre de traction',  fields: [], defaults: {} },
      { key: 'cable_machine', category: 'cable_machine', name: 'Poulie / câble',     fields: [], defaults: {} },
      { key: 'smith_machine', category: 'smith_machine', name: 'Smith machine',      fields: [], defaults: {} },
    ],
  },
]
