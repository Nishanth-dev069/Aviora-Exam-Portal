CREATE OR REPLACE FUNCTION get_exam_report(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_summary  jsonb;
  v_students jsonb;
  v_question_analysis jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Class-level summary
  SELECT jsonb_build_object(
    'exam_id',            p_exam_id,
    'enrolled_count',     COUNT(DISTINCT ee.student_id),
    'submitted_count',    COUNT(DISTINCT er.student_id),
    'avg_percentage',     ROUND(AVG(er.percentage), 2),
    'highest_percentage', MAX(er.percentage),
    'pass_count',   COUNT(*) FILTER (WHERE er.is_passed = true),
    'fail_count',   COUNT(*) FILTER (WHERE er.is_passed = false)
  ) INTO v_summary
  FROM exam_enrollments ee
  LEFT JOIN exam_results er
         ON er.exam_id = ee.exam_id AND er.student_id = ee.student_id
  WHERE ee.exam_id = p_exam_id;

  -- Per-student results with rank
  SELECT jsonb_agg(
    jsonb_build_object(
      'rank',               ROW_NUMBER() OVER (ORDER BY er.percentage DESC),
      'student_id',         sp.user_id,
      'full_name',          sp.full_name,
      'roll_number',        sp.roll_number,
      'total_score',        er.total_score,
      'max_score',          er.max_score,
      'percentage',         er.percentage,
      'is_passed',          er.is_passed,
      'time_taken_seconds', er.time_taken_seconds,
      'session_id',         er.session_id
    ) ORDER BY er.percentage DESC
  ) INTO v_students
  FROM exam_results er
  INNER JOIN student_profiles sp ON sp.user_id = er.student_id
  WHERE er.exam_id = p_exam_id;

  RETURN jsonb_build_object(
    'summary',  v_summary,
    'students', COALESCE(v_students, '[]'::jsonb)
  );
END;
$$;
