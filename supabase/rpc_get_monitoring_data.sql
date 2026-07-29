CREATE OR REPLACE FUNCTION get_monitoring_data(p_exam_id uuid)
RETURNS TABLE (
  full_name text,
  roll_number text,
  session_id uuid,
  status text,
  started_at timestamptz,
  expires_at timestamptz,
  submitted_at timestamptz,
  last_synced_at timestamptz,
  security_violations integer,
  enrolled_id uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.full_name, sp.roll_number,
    es.id as session_id, es.status, es.started_at, es.expires_at,
    es.submitted_at, es.last_synced_at, es.security_violations,
    ee.id as enrolled_id
  FROM exam_enrollments ee
  JOIN student_profiles sp ON sp.user_id = ee.student_id
  LEFT JOIN exam_sessions es ON es.exam_id = ee.exam_id AND es.student_id = ee.student_id
    AND es.status IN ('active', 'submitted', 'expired', 'terminated')
  WHERE ee.exam_id = p_exam_id
  ORDER BY sp.full_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;
