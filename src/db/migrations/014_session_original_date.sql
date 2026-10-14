ALTER TABLE session ADD COLUMN original_scheduled_date TEXT;
UPDATE session SET original_scheduled_date=scheduled_date;
