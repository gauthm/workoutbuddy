ALTER TABLE user_profile ADD COLUMN date_of_birth TEXT;

-- Independent of programs/templates: deleting a program retains learned progression.
CREATE TABLE IF NOT EXISTS exercise_progression (
  exercise_id TEXT PRIMARY KEY REFERENCES exercise(id) ON DELETE CASCADE,
  current_weight_kg REAL NOT NULL DEFAULT 0,
  current_target_reps INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  target_reps_min INTEGER,
  target_reps_max INTEGER,
  last_session_id INTEGER,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO exercise_progression
  (exercise_id,current_weight_kg,current_target_reps,consecutive_failures,target_reps_min,target_reps_max,last_session_id,last_updated)
SELECT te.exercise_id,ps.current_weight_kg,ps.current_target_reps,ps.consecutive_failures,
  te.target_reps_min,te.target_reps_max,ps.last_session_id,ps.last_updated
FROM progression_state ps JOIN template_exercise te ON te.id=ps.template_exercise_id
WHERE ps.last_session_id IS NOT NULL AND EXISTS (SELECT 1 FROM session s WHERE s.id=ps.last_session_id AND s.status='completed')
ORDER BY ps.last_updated DESC,ps.last_session_id DESC;
