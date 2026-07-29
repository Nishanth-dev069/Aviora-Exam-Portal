CREATE OR REPLACE FUNCTION create_exam_session(
  p_exam_id          uuid,
  p_student_id       uuid,
  p_duration_minutes integer,
  p_question_order   jsonb,   -- shuffled array of question UUIDs
  p_option_orders    jsonb,   -- { question_id: [option_id, ...] }
  p_device_info      jsonb,
  p_ip_address       text,
  p_student_role     text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_session_id       uuid;
  v_submission_token uuid        := gen_random_uuid();
  v_expires_at       timestamptz := now() + (p_duration_minutes * interval '1 minute');

BEGIN
  -- 1. question_order is a non-empty JSON array
  IF jsonb_typeof(p_question_order) != 'array' OR jsonb_array_length(p_question_order) = 0 THEN
    RAISE EXCEPTION 'INVALID_QUESTION_ORDER';
  END IF;

  -- 2. Every element is a valid UUID & 3. No duplicates
  IF (
    SELECT COUNT(*) FROM jsonb_array_elements_text(p_question_order)
  ) != (
    SELECT COUNT(DISTINCT value) FROM jsonb_array_elements_text(p_question_order)
  ) THEN
    RAISE EXCEPTION 'INVALID_QUESTION_ORDER';
  END IF;

  -- Confirm all question IDs belong to this exam's snapshot
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(p_question_order) AS elem
    WHERE NOT EXISTS (
      SELECT 1 FROM exam_questions
      WHERE exam_id = p_exam_id
      AND question_id = elem::uuid
    )
  ) THEN
    RAISE EXCEPTION 'VALIDATION_QUESTION_NOT_IN_EXAM';
  END IF;

  -- 4. option_orders is a JSON object
  IF jsonb_typeof(p_option_orders) != 'object' THEN
    RAISE EXCEPTION 'INVALID_OPTION_ORDERS';
  END IF;

  -- 5. & 6. option_orders keys exactly match question_order elements
  IF (
    SELECT COUNT(*) FROM jsonb_array_elements_text(p_question_order) AS q
    WHERE NOT p_option_orders ? q
  ) > 0 OR (
    SELECT COUNT(*) FROM jsonb_object_keys(p_option_orders) AS k
    WHERE NOT p_question_order @> to_jsonb(k)
  ) > 0 THEN
    RAISE EXCEPTION 'INVALID_OPTION_ORDERS';
  END IF;

  -- 7. Every option UUID supplied in option_orders belongs to its associated question
  IF EXISTS (
    SELECT 1
    FROM jsonb_each(p_option_orders) AS qo(q_id, opts),
         jsonb_array_elements_text(opts) AS o(opt_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM question_options
      WHERE id = opt_id::uuid AND question_id = qo.q_id::uuid
    )
  ) THEN
    RAISE EXCEPTION 'INVALID_OPTION_ORDERS';
  END IF;

  -- Insert the exam session with exception-based concurrency control
  BEGIN
    INSERT INTO exam_sessions (
      exam_id, student_id, status, started_at, expires_at,
      question_order, option_orders, submission_token, device_info, ip_address
    ) VALUES (
      p_exam_id, p_student_id, 'active', now(), v_expires_at,
      p_question_order, p_option_orders, v_submission_token,
      p_device_info, p_ip_address::inet
    ) RETURNING id INTO v_session_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ALREADY_EXISTS';
  END;

  -- Insert one student_answers placeholder per question
  INSERT INTO student_answers (
    session_id, question_id,
    selected_option_id, is_visited, is_marked_for_review, time_spent_seconds
  )
  SELECT v_session_id, (elem::text)::uuid, NULL, false, false, 0
  FROM jsonb_array_elements_text(p_question_order) AS elem;

  -- Audit log
  INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id, ip_address)
  VALUES (
    p_student_id, p_student_role, 'exam.session_created',
    'exam', p_exam_id, p_ip_address::inet
  );

  RETURN jsonb_build_object(
    'id',               v_session_id,
    'exam_id',          p_exam_id,
    'started_at',       now(),
    'expires_at',       v_expires_at,
    'submission_token', v_submission_token,
    'status',           'active'
  );
END;
$$;
