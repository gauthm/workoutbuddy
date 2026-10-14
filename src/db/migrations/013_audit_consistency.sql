ALTER TABLE program ADD COLUMN started_on TEXT;
UPDATE program SET started_on=COALESCE(
  (SELECT MIN(scheduled_date) FROM session WHERE program_id=program.id), substr(created_at,1,10))
WHERE is_active=1 OR EXISTS(SELECT 1 FROM session WHERE program_id=program.id);
INSERT OR IGNORE INTO settings(key,value) VALUES ('painful_muscles','[]');
CREATE TABLE exercise_progression_event (
  session_exercise_id INTEGER PRIMARY KEY REFERENCES session_exercise(id) ON DELETE CASCADE,
  context TEXT NOT NULL
);
