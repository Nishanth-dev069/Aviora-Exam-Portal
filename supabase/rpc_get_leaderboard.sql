CREATE OR REPLACE FUNCTION get_leaderboard(p_exam_id uuid)
RETURNS TABLE (
  rank         bigint,
  student_id   uuid,
  full_name    text,
  total_score  numeric,
  percentage   numeric,
  submitted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Validate leaderboard publication state
  IF NOT EXISTS (
    SELECT 1 FROM exams
    WHERE id = p_exam_id
      AND status IN ('active', 'completed')
      AND (
        settings->>'show_leaderboard_after' = 'always' OR
        (settings->>'show_leaderboard_after' = 'exam_end' AND (status = 'completed' OR type = 'practice'))
      )
  ) THEN
    RAISE EXCEPTION 'LEADERBOARD_UNAVAILABLE';
  END IF;

  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY er.percentage DESC, er.computed_at ASC),
    er.student_id,
    sp.full_name,
    er.total_score,
    er.percentage,
    es.submitted_at
  FROM exam_results er
  INNER JOIN student_profiles sp
          ON sp.user_id = er.student_id AND sp.deleted_at IS NULL
  INNER JOIN exam_sessions es ON es.id = er.session_id
  WHERE er.exam_id = p_exam_id
  ORDER BY er.percentage DESC, er.computed_at ASC
  LIMIT 50;
END;
$$;
