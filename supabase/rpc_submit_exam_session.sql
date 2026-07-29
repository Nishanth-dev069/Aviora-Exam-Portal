CREATE OR REPLACE FUNCTION submit_exam_session(
  p_session_id       uuid,
  p_student_id       uuid,
  p_submission_token uuid,
  p_ip_address       text,
  p_student_role     text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_session          exam_sessions%ROWTYPE;
  v_exam             exams%ROWTYPE;
  v_result_id        uuid;
  v_total_score      numeric := 0;
  v_max_score        numeric := 0;
  v_correct_count    integer := 0;
  v_incorrect_count  integer := 0;
  v_unanswered_count integer := 0;
  v_time_taken       integer := 0;
  v_result_data      jsonb;
  v_is_passed        boolean;
  v_percentage       numeric;
  v_existing         jsonb;
BEGIN
  -- Fetch and validate session ownership with row lock
  SELECT * INTO v_session FROM exam_sessions
  WHERE id = p_session_id AND student_id = p_student_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  -- Validate submission token
  IF v_session.submission_token != p_submission_token THEN
    RAISE EXCEPTION 'INVALID_TOKEN';
  END IF;

  -- Idempotency: return existing result if already submitted
  IF v_session.status = 'submitted' THEN
    SELECT jsonb_build_object(
      'id', id, 'session_id', session_id, 'exam_id', exam_id,
      'total_score', total_score, 'max_score', max_score,
      'percentage', percentage, 'is_passed', is_passed,
      'result_data', result_data
    ) INTO v_existing FROM exam_results WHERE session_id = p_session_id;
    RETURN v_existing;
  END IF;

  -- Accept 'active' or 'expired' (timer may have just run out)
  IF v_session.status NOT IN ('active', 'expired') THEN
    RAISE EXCEPTION 'SESSION_INVALID: status=%', v_session.status;
  END IF;

  -- Compute and store result
  PERFORM compute_and_store_result(p_session_id, p_student_id);

  -- Mark session submitted
  UPDATE exam_sessions
  SET status = 'submitted', submitted_at = now()
  WHERE id = p_session_id;

  SELECT id, total_score, max_score, percentage, is_passed, result_data 
  INTO v_result_id, v_total_score, v_max_score, v_percentage, v_is_passed, v_result_data 
  FROM exam_results WHERE session_id = p_session_id;

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, actor_role, action, resource_type, resource_id, metadata, ip_address
  ) VALUES (
    p_student_id, p_student_role, 'exam.session_submitted',
    'exam_session', p_session_id,
    jsonb_build_object('score', v_total_score, 'percentage', v_percentage),
    p_ip_address::inet
  );

  RETURN jsonb_build_object(
    'id',          v_result_id,
    'session_id',  p_session_id,
    'exam_id',     v_session.exam_id,
    'total_score', v_total_score,
    'max_score',   v_max_score,
    'percentage',  v_percentage,
    'is_passed',   v_is_passed,
    'result_data', v_result_data
  );
END;
$$;
