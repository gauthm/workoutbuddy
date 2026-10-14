-- Merge legacy catalogue duplicates without deleting sets, templates or learned progress.
CREATE TEMP TABLE catalogue_alias AS
SELECT legacy.id AS old_id, MIN(catalogue.id) AS catalogue_id
FROM exercise legacy JOIN exercise catalogue
  ON catalogue.is_custom=0 AND (
    lower(trim(legacy.name_en))=lower(trim(catalogue.name_en)) OR
    (lower(trim(legacy.name_en))='hammer curl' AND catalogue.id='hammer_curls'))
WHERE legacy.is_custom=1 GROUP BY legacy.id;

-- Select the most recently learned state, including an existing catalogue state.
CREATE TEMP TABLE catalogue_progression AS
SELECT * FROM (
  SELECT ep.*,COALESCE(a.catalogue_id,ep.exercise_id) AS canonical_id,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(a.catalogue_id,ep.exercise_id)
      ORDER BY ep.last_updated DESC,COALESCE(ep.last_session_id,0) DESC,ep.exercise_id) AS rank
  FROM exercise_progression ep LEFT JOIN catalogue_alias a ON a.old_id=ep.exercise_id
  WHERE ep.exercise_id IN (SELECT old_id FROM catalogue_alias)
     OR ep.exercise_id IN (SELECT catalogue_id FROM catalogue_alias)
) WHERE rank=1;
INSERT OR REPLACE INTO exercise_progression
  (exercise_id,current_weight_kg,current_target_reps,consecutive_failures,
   target_reps_min,target_reps_max,last_session_id,last_updated)
SELECT canonical_id,current_weight_kg,current_target_reps,consecutive_failures,
  target_reps_min,target_reps_max,last_session_id,last_updated FROM catalogue_progression;

UPDATE exercise SET is_excluded=1,exclusion_reason=COALESCE(exclusion_reason,
  (SELECT e.exclusion_reason FROM exercise e JOIN catalogue_alias a ON e.id=a.old_id
    WHERE a.catalogue_id=exercise.id AND e.is_excluded=1 LIMIT 1))
WHERE id IN (SELECT a.catalogue_id FROM catalogue_alias a JOIN exercise e ON e.id=a.old_id WHERE e.is_excluded=1);
UPDATE template_exercise SET exercise_id=(SELECT catalogue_id FROM catalogue_alias WHERE old_id=exercise_id)
WHERE exercise_id IN (SELECT old_id FROM catalogue_alias);
UPDATE template_exercise SET rotation_group=(SELECT json_group_array(COALESCE(a.catalogue_id,j.value))
  FROM json_each(template_exercise.rotation_group) j LEFT JOIN catalogue_alias a ON a.old_id=j.value)
WHERE rotation_group IS NOT NULL AND json_valid(rotation_group);
UPDATE session_exercise SET exercise_id=(SELECT catalogue_id FROM catalogue_alias WHERE old_id=exercise_id)
WHERE exercise_id IN (SELECT old_id FROM catalogue_alias);
UPDATE personal_record SET exercise_id=(SELECT catalogue_id FROM catalogue_alias WHERE old_id=exercise_id)
WHERE exercise_id IN (SELECT old_id FROM catalogue_alias);
-- Keep advice history, dismiss obsolete active signals before unifying their IDs.
UPDATE equipment_advice SET status='dismissed',dismissed_at=datetime('now')
WHERE status='active' AND exercise_id IN (SELECT old_id FROM catalogue_alias);
UPDATE equipment_advice SET exercise_id=(SELECT catalogue_id FROM catalogue_alias WHERE old_id=exercise_id)
WHERE exercise_id IN (SELECT old_id FROM catalogue_alias);
UPDATE exercise_progression_event SET context=json_set(context,'$.template.exercise_id',
  (SELECT catalogue_id FROM catalogue_alias WHERE old_id=json_extract(context,'$.template.exercise_id')))
WHERE json_extract(context,'$.template.exercise_id') IN (SELECT old_id FROM catalogue_alias);
DELETE FROM exercise WHERE id IN (SELECT old_id FROM catalogue_alias);
DROP TABLE catalogue_progression;
DROP TABLE catalogue_alias;
