-- Migration 004 : nouvelles catégories équipement
-- SQLite ne supporte pas ALTER COLUMN CHECK — on recrée la table.

-- 1. Sauvegarder les données existantes
CREATE TABLE IF NOT EXISTS equipment_item_backup AS
SELECT * FROM equipment_item;

-- 2. Supprimer l'ancienne table
DROP TABLE IF EXISTS equipment_item;

-- 3. Recréer avec les nouvelles catégories dans le CHECK
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

-- 4. Réinsérer les données existantes (toutes valides dans le nouveau schéma)
INSERT INTO equipment_item
  (id, category, name, weight_kg, count, weight_min_kg, weight_max_kg,
   weight_step_kg, resistance_min_kg, resistance_max_kg, notes, created_at)
SELECT
  id, category, name, weight_kg, count, weight_min_kg, weight_max_kg,
  weight_step_kg, resistance_min_kg, resistance_max_kg, notes, created_at
FROM equipment_item_backup;

-- 5. Nettoyer la table temporaire
DROP TABLE IF EXISTS equipment_item_backup;
