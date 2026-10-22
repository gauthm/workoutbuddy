-- Add the power tower without changing existing inventory.
CREATE TABLE IF NOT EXISTS equipment_item_before_roman_chair AS
SELECT * FROM equipment_item;

-- 2. Drop the old table
DROP TABLE IF EXISTS equipment_item;

-- 3. Recreate with the new categories in the CHECK constraint
CREATE TABLE IF NOT EXISTS equipment_item (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  category            TEXT    NOT NULL
                      CHECK(category IN (
                        'barbell',
                        'ez_bar',
                        'plate',
                        'dumbbell_plate',
                        'dumbbell_fixed',
                        'dumbbell_adjustable',
                        'dumbbell_loadable',
                        'kettlebell',
                        'resistance_band',
                        'bench',
                        'bench_adjustable',
                        'rack',
                        'pullup_bar',
                        'roman_chair',
                        'dip_station',
                        'gym_mat',
                        'ab_wheel',
                        'leg_press',
                        'leg_extension',
                        'leg_curl',
                        'lat_pulldown',
                        'seated_row',
                        'chest_press',
                        'shoulder_press',
                        'pec_deck',
                        'treadmill',
                        'stationary_bike',
                        'elliptical',
                        'rowing_machine',
                        'cable_machine',
                        'smith_machine',
                        'other'
                      )),
  name                TEXT    NOT NULL,
  weight_kg           REAL,
  count               INTEGER NOT NULL DEFAULT 1,
  weight_min_kg       REAL,
  weight_max_kg       REAL,
  weight_step_kg      REAL,
  resistance_min_kg   REAL,
  resistance_max_kg   REAL,
  notes               TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 4. Reinsert existing data (all valid under the new schema)
INSERT INTO equipment_item
  (id, category, name, weight_kg, count, weight_min_kg, weight_max_kg,
   weight_step_kg, resistance_min_kg, resistance_max_kg, notes, created_at)
SELECT
  id, category, name, weight_kg, count, weight_min_kg, weight_max_kg,
  weight_step_kg, resistance_min_kg, resistance_max_kg, notes, created_at
FROM equipment_item_before_roman_chair;

-- 5. Clean up the temporary table
DROP TABLE IF EXISTS equipment_item_before_roman_chair;
