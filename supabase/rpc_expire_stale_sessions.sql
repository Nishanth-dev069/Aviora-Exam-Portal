CREATE OR REPLACE FUNCTION expire_stale_sessions()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated_rows AS (
    UPDATE exam_sessions
    SET status = 'expired', updated_at = now()
    WHERE status = 'active'
      AND expires_at < now() - interval '2 minutes'
    RETURNING id, student_id
  )
  INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id)
  SELECT student_id, 'system', 'exam.session_expired', 'exam_session', id
  FROM updated_rows;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
