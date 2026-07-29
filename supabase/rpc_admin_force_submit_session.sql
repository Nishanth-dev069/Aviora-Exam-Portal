CREATE OR REPLACE FUNCTION admin_force_submit_session(
  p_session_id uuid,
  p_admin_id   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_session exam_sessions%ROWTYPE;
BEGIN
  -- Authorization
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Fetch and lock session
  SELECT * INTO v_session
  FROM exam_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  -- Only force-submit active or expired sessions
  IF v_session.status NOT IN ('active', 'expired') THEN
    RAISE EXCEPTION 'SESSION_INVALID: status=%', v_session.status;
  END IF;

  -- Compute and store result (idempotent)
  PERFORM compute_and_store_result(p_session_id, v_session.student_id);

  -- Mark submitted
  UPDATE exam_sessions
  SET status = 'submitted', submitted_at = now()
  WHERE id = p_session_id;

  -- Audit log
  INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id, metadata)
  VALUES (
    p_admin_id, 'admin', 'admin.force_submitted',
    'exam_session', p_session_id,
    jsonb_build_object('student_id', v_session.student_id, 'exam_id', v_session.exam_id)
  );

  RETURN jsonb_build_object('session_id', p_session_id, 'status', 'submitted');
END;
$$;
