CREATE TABLE session_schedule_exclusion (
  program_id INTEGER NOT NULL REFERENCES program(id) ON DELETE CASCADE,
  scheduled_date TEXT NOT NULL,
  PRIMARY KEY(program_id,scheduled_date)
);
