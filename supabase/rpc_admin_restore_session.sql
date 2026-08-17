-- RPC: admin_restore_exam_session
-- Safely restores an auto-submitted, submitted, expired, or terminated exam session back to active status.

CREATE OR REPLACE FUNCTION admin_restore_exam_session(
  p_session_id       uuid,
  p_extra_minutes    integer DEFAULT 30,
  p_reset_violations boolean DEFAULT true,
  p_admin_id         uuid DEFAULT NULL,
  p_reason           text DEFAULT 'Admin session restore'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_session          exam_sessions%ROWTYPE;
  v_admin_role       text := 'admin';
  v_new_expires_at   timestamptz;
BEGIN
  -- 1. Fetch session with row lock
  SELECT * INTO v_session 
  FROM exam_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  -- 2. Verify session is in a restorable state
  IF v_session.status NOT IN ('submitted', 'expired', 'terminated') THEN
    RAISE EXCEPTION 'SESSION_NOT_RESTORABLE: status is %', v_session.status;
  END IF;

  -- 3. Calculate new expiration time
  -- Ensure expires_at is at least now() + extra_minutes
  v_new_expires_at := GREATEST(v_session.expires_at, now()) + (COALESCE(p_extra_minutes, 30) * INTERVAL '1 minute');

  -- 4. Temporarily disable trigger er_immutable to remove premature results
  BEGIN
    ALTER TABLE exam_results DISABLE TRIGGER er_immutable;
    DELETE FROM exam_results WHERE session_id = p_session_id;
    ALTER TABLE exam_results ENABLE TRIGGER er_immutable;
  EXCEPTION WHEN OTHERS THEN
    -- In case of trigger permission issues or already deleted
    BEGIN
      ALTER TABLE exam_results ENABLE TRIGGER er_immutable;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  -- 5. Restore the session to active
  UPDATE exam_sessions
  SET 
    status = 'active',
    submitted_at = NULL,
    security_violations = CASE WHEN p_reset_violations THEN 0 ELSE v_session.security_violations END,
    expires_at = v_new_expires_at,
    updated_at = now()
  WHERE id = p_session_id;

  -- 6. Log audit event
  IF p_admin_id IS NOT NULL THEN
    SELECT role INTO v_admin_role FROM users WHERE id = p_admin_id;
    
    INSERT INTO audit_logs (
      actor_id, actor_role, action, resource_type, resource_id, metadata
    ) VALUES (
      p_admin_id,
      COALESCE(v_admin_role, 'admin'),
      'admin.session_restored',
      'exam_session',
      p_session_id,
      jsonb_build_object(
        'reason', p_reason,
        'extra_minutes', p_extra_minutes,
        'reset_violations', p_reset_violations,
        'previous_status', v_session.status,
        'new_expires_at', v_new_expires_at
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'status', 'active',
    'expires_at', v_new_expires_at,
    'security_violations', CASE WHEN p_reset_violations THEN 0 ELSE v_session.security_violations END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_restore_exam_session TO authenticated;
