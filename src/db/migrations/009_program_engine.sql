-- Generation parameters are retained for explanations; existing programs are preserved.
CREATE TABLE IF NOT EXISTS program_plan (
  program_id INTEGER PRIMARY KEY REFERENCES program(id) ON DELETE CASCADE,
  engine_version INTEGER NOT NULL DEFAULT 1,
  parameters TEXT NOT NULL,
  warnings TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS program_weekly_review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES program(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,
  decision TEXT NOT NULL,
  evidence TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(program_id, week_start)
);
