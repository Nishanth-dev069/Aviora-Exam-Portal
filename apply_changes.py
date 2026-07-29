import os

with open('supabase/exam-portal-sql.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1 & 8: Reject mutation and set_updated_at search path
content = content.replace("""("h3", "IMMUTABILITY TRIGGERS"),
("sql", \"\"\"CREATE OR REPLACE FUNCTION reject_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Table % is immutable. Modification blocked.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;\"\"\"),

SECTIONS.append(("UPDATED_AT AUTO-TRIGGER", [

("info", "This single function is reused by ALL tables that have an updated_at column. Create it before any tables."),

("sql", \"\"\"-- Universal updated_at trigger function
-- Applied to every table that has an updated_at column.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;\"\"\"),""",
"""("h3", "IMMUTABILITY TRIGGERS"),
("sql", \"\"\"CREATE OR REPLACE FUNCTION reject_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_TABLE: % cannot be modified after insert. Table: %, Operation: %',
    TG_TABLE_NAME, TG_TABLE_NAME, TG_OP;
END;
$$;\"\"\"),

SECTIONS.append(("UPDATED_AT AUTO-TRIGGER", [

("info", "This single function is reused by ALL tables that have an updated_at column. Create it before any tables."),

("sql", \"\"\"-- Universal updated_at trigger function
-- Applied to every table that has an updated_at column.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;\"\"\"),""")

# Ensure trigger syntax for reject_mutation
content = content.replace("EXECUTE FUNCTION prevent_modification();", "EXECUTE FUNCTION reject_mutation();")

# 7. Add updated_at trigger to active_sessions
content = content.replace("""  last_active_at timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL
);\"\"\"),""", """  last_active_at timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER active_sessions_updated_at
  BEFORE UPDATE ON active_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();\"\"\"),""")

# 2. compute_and_store_result
compute_and_store_result = """("h3", "FUNCTION: compute_and_store_result"),
("body", "Internal helper to compute results for an expiring or submitted session. Idempotent."),
("sql", \"\"\"CREATE OR REPLACE FUNCTION compute_and_store_result(p_session_id uuid, p_student_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_session          exam_sessions%ROWTYPE;
  v_exam             exams%ROWTYPE;
  v_total_score      numeric := 0;
  v_max_score        numeric := 0;
  v_correct_count    integer := 0;
  v_incorrect_count  integer := 0;
  v_unanswered_count integer := 0;
  v_time_taken       integer := 0;
  v_result_data      jsonb;
  v_is_passed        boolean;
  v_percentage       numeric;
BEGIN
  -- Idempotency check
  IF EXISTS (SELECT 1 FROM exam_results WHERE session_id = p_session_id) THEN
    RETURN;
  END IF;

  SELECT * INTO v_session FROM exam_sessions WHERE id = p_session_id;
  SELECT * INTO v_exam FROM exams WHERE id = v_session.exam_id;

  WITH answer_eval AS (
    SELECT
      sa.question_id,
      q.content                                              AS question_content,
      q.explanation,
      sa.selected_option_id,
      sel.content                                            AS selected_option_content,
      cor.id                                                 AS correct_option_id,
      cor.content                                            AS correct_option_content,
      sa.time_spent_seconds,
      eq.marks                                               AS question_marks,
      (sa.selected_option_id IS NULL)                        AS is_unanswered,
      (sel.id IS NOT NULL AND sel.is_correct = true)         AS is_correct,
      eq.base_order
    FROM student_answers sa
    INNER JOIN exam_questions eq
           ON eq.question_id = sa.question_id
          AND eq.exam_id     = v_session.exam_id
    INNER JOIN questions q ON q.id = sa.question_id
    LEFT  JOIN question_options sel ON sel.id = sa.selected_option_id
    INNER JOIN question_options cor
           ON cor.question_id = sa.question_id AND cor.is_correct = true
    WHERE sa.session_id = p_session_id
  ),
  scored AS (
    SELECT *,
      CASE
        WHEN is_unanswered THEN 0::numeric
        WHEN is_correct    THEN question_marks
        ELSE -(v_exam.negative_marks)
      END AS marks_awarded
    FROM answer_eval
  )
  SELECT
    GREATEST(0, COALESCE(SUM(marks_awarded), 0)),
    COALESCE(SUM(question_marks), 0),
    COUNT(*) FILTER (WHERE is_correct),
    COUNT(*) FILTER (WHERE NOT is_correct AND NOT is_unanswered),
    COUNT(*) FILTER (WHERE is_unanswered),
    jsonb_build_object(
      'questions',
      COALESCE(jsonb_agg(jsonb_build_object(
        'question_id',             question_id,
        'question_content',        question_content,
        'selected_option_id',      selected_option_id,
        'selected_option_content', selected_option_content,
        'correct_option_id',       correct_option_id,
        'correct_option_content',  correct_option_content,
        'is_correct',              is_correct,
        'is_unanswered',           is_unanswered,
        'marks_awarded',           marks_awarded,
        'explanation',             explanation,
        'time_spent_seconds',      time_spent_seconds
      ) ORDER BY base_order ASC), '[]'::jsonb)
    )
  INTO
    v_total_score, v_max_score, v_correct_count,
    v_incorrect_count, v_unanswered_count, v_result_data
  FROM scored;

  v_percentage := CASE WHEN v_max_score > 0 THEN ROUND((v_total_score / v_max_score) * 100, 2) ELSE 0 END;
  v_is_passed := CASE WHEN v_exam.passing_marks IS NOT NULL THEN v_total_score >= v_exam.passing_marks ELSE NULL END;
  v_time_taken := LEAST(EXTRACT(EPOCH FROM (now() - v_session.started_at))::integer, (v_exam.duration_minutes * 60));

  INSERT INTO exam_results (
    session_id, exam_id, student_id,
    total_score, max_score, percentage,
    correct_count, incorrect_count, unanswered_count,
    time_taken_seconds, is_passed, result_data
  ) VALUES (
    p_session_id, v_session.exam_id, p_student_id,
    v_total_score, v_max_score, v_percentage,
    v_correct_count, v_incorrect_count, v_unanswered_count,
    v_time_taken, v_is_passed, v_result_data
  ) ON CONFLICT DO NOTHING;
END;
$$;\"\"\"),

("h3", "FUNCTION: submit_exam_session"),"""

# Refactor submit_exam_session
content = content.replace("""  -- Fetch exam config
  SELECT * INTO v_exam FROM exams WHERE id = v_session.exam_id;

  -- Compute results joining student_answers → questions → correct options
  -- max_score uses SUM(eq.marks) — handles variable marks per question
  WITH answer_eval AS (
    SELECT
      sa.question_id,
      q.content                                              AS question_content,
      q.explanation,
      sa.selected_option_id,
      sel.content                                            AS selected_option_content,
      cor.id                                                 AS correct_option_id,
      cor.content                                            AS correct_option_content,
      sa.time_spent_seconds,
      eq.marks                                               AS question_marks,
      (sa.selected_option_id IS NULL)                        AS is_unanswered,
      (sel.id IS NOT NULL AND sel.is_correct = true)         AS is_correct,
      eq.base_order
    FROM student_answers sa
    INNER JOIN exam_questions eq
           ON eq.question_id = sa.question_id
          AND eq.exam_id     = v_session.exam_id
    INNER JOIN questions q ON q.id = sa.question_id
    LEFT  JOIN question_options sel ON sel.id = sa.selected_option_id
    INNER JOIN question_options cor
           ON cor.question_id = sa.question_id AND cor.is_correct = true
    WHERE sa.session_id = p_session_id
  ),
  scored AS (
    SELECT *,
      CASE
        WHEN is_unanswered THEN 0::numeric
        WHEN is_correct    THEN question_marks
        ELSE -(v_exam.negative_marks)
      END AS marks_awarded
    FROM answer_eval
  )
  SELECT
    GREATEST(0, COALESCE(SUM(marks_awarded), 0)),
    COALESCE(SUM(question_marks), 0),
    COUNT(*) FILTER (WHERE is_correct),
    COUNT(*) FILTER (WHERE NOT is_correct AND NOT is_unanswered),
    COUNT(*) FILTER (WHERE is_unanswered),
    jsonb_build_object(
      'questions',
      COALESCE(jsonb_agg(jsonb_build_object(
        'question_id',             question_id,
        'question_content',        question_content,
        'selected_option_id',      selected_option_id,
        'selected_option_content', selected_option_content,
        'correct_option_id',       correct_option_id,
        'correct_option_content',  correct_option_content,
        'is_correct',              is_correct,
        'is_unanswered',           is_unanswered,
        'marks_awarded',           marks_awarded,
        'explanation',             explanation,
        'time_spent_seconds',      time_spent_seconds
      ) ORDER BY base_order ASC), '[]'::jsonb)
    )
  INTO
    v_total_score, v_max_score, v_correct_count,
    v_incorrect_count, v_unanswered_count, v_result_data
  FROM scored;

  -- Derived calculations
  v_percentage := CASE
    WHEN v_max_score > 0 THEN ROUND((v_total_score / v_max_score) * 100, 2)
    ELSE 0
  END;
  v_is_passed := CASE
    WHEN v_exam.passing_marks IS NOT NULL THEN v_total_score >= v_exam.passing_marks
    ELSE NULL
  END;
  -- Time taken: capped to configured duration
  v_time_taken := LEAST(
    EXTRACT(EPOCH FROM (now() - v_session.started_at))::integer,
    (v_exam.duration_minutes * 60)
  );

  -- Mark session submitted
  UPDATE exam_sessions
  SET status = 'submitted', submitted_at = now()
  WHERE id = p_session_id;

  -- Store result (UNIQUE constraint on session_id prevents duplicates)
  INSERT INTO exam_results (
    session_id, exam_id, student_id,
    total_score, max_score, percentage,
    correct_count, incorrect_count, unanswered_count,
    time_taken_seconds, is_passed, result_data
  ) VALUES (
    p_session_id, v_session.exam_id, p_student_id,
    v_total_score, v_max_score, v_percentage,
    v_correct_count, v_incorrect_count, v_unanswered_count,
    v_time_taken, v_is_passed, v_result_data
  ) RETURNING id INTO v_result_id;""", """  -- Compute and store result
  PERFORM compute_and_store_result(p_session_id, p_student_id);

  -- Mark session submitted
  UPDATE exam_sessions
  SET status = 'submitted', submitted_at = now()
  WHERE id = p_session_id;

  SELECT id, total_score, percentage INTO v_result_id, v_total_score, v_percentage FROM exam_results WHERE session_id = p_session_id;""")

# Also need to get v_max_score, v_is_passed, v_result_data from exam_results to build the JSON response
content = content.replace("""  SELECT id, total_score, percentage INTO v_result_id, v_total_score, v_percentage FROM exam_results WHERE session_id = p_session_id;""", """  SELECT id, total_score, max_score, percentage, is_passed, result_data 
  INTO v_result_id, v_total_score, v_max_score, v_percentage, v_is_passed, v_result_data 
  FROM exam_results WHERE session_id = p_session_id;""")

content = content.replace('("h3", "FUNCTION: submit_exam_session"),', compute_and_store_result)

# 10 & 2. expire_stale_sessions
content = content.replace("""("sql", \"\"\"CREATE OR REPLACE FUNCTION expire_stale_sessions()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH updated_rows AS (
    UPDATE exam_sessions
    SET status = 'expired', updated_at = now()
    WHERE status = 'active'
      AND expires_at < now() - interval '2 minutes'
    RETURNING id, student_id
  ),
  audit_insert AS (
    INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id)
    SELECT student_id, 'system', 'exam.session_expired', 'exam_session', id
    FROM updated_rows
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated_rows;
  RETURN v_count;
END;
$$;

-- Schedule via Supabase Dashboard > Database > Cron Jobs:""", """("sql", \"\"\"-- NOTE: Sessions are expired only when expires_at < now() - interval '2 minutes'.
-- This 2-minute grace period is intentional — it gives the client-side auto-submit
-- time to fire first (triggered at t=0 by the countdown timer). The cron job is
-- the fallback, not the primary submission path. Do not reduce this interval.
CREATE OR REPLACE FUNCTION expire_stale_sessions()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_count integer := 0;
  v_row record;
BEGIN
  FOR v_row IN (
    UPDATE exam_sessions
    SET status = 'expired', updated_at = now()
    WHERE status = 'active'
      AND expires_at < now() - interval '2 minutes'
    RETURNING id, student_id
  ) LOOP
    PERFORM compute_and_store_result(v_row.id, v_row.student_id);
    
    INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id)
    VALUES (v_row.student_id, 'system', 'exam.session_expired', 'exam_session', v_row.id);
    
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Schedule via Supabase Dashboard > Database > Cron Jobs:""")

# 3. admin_force_submit_session
admin_force_submit = """("h3", "FUNCTION: admin_force_submit_session"),
("body", "Force submits a session. Requires admin privileges."),
("sql", \"\"\"CREATE OR REPLACE FUNCTION admin_force_submit_session(
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
$$;\"\"\"),

"""
content = content.replace('("h3", "FUNCTION: expire_stale_sessions"),', admin_force_submit + '("h3", "FUNCTION: expire_stale_sessions"),')

# 4. Extend get_exam_report
content = content.replace("""    sp.full_name,
    er.total_score,
    er.percentage,
    es.status,
    es.started_at,
    es.submitted_at
  FROM exam_results er
  INNER JOIN student_profiles sp
          ON sp.user_id = er.student_id AND sp.deleted_at IS NULL
  INNER JOIN exam_sessions es ON es.id = er.session_id
  WHERE er.exam_id = p_exam_id
  ORDER BY er.percentage DESC;

  RETURN jsonb_build_object(
    'summary',  v_summary,
    'students', COALESCE(v_students, '[]'::jsonb)
  );
END;""", """    sp.full_name,
    er.total_score,
    er.percentage,
    es.status,
    es.started_at,
    es.submitted_at
  FROM exam_results er
  INNER JOIN student_profiles sp
          ON sp.user_id = er.student_id AND sp.deleted_at IS NULL
  INNER JOIN exam_sessions es ON es.id = er.session_id
  WHERE er.exam_id = p_exam_id
  ORDER BY er.percentage DESC;

  SELECT jsonb_agg(
    jsonb_build_object(
      'question_id',       qa.question_id,
      'question_content',  qa.question_content,
      'total_attempts',    qa.total_attempts,
      'correct_count',     qa.correct_count,
      'incorrect_count',   qa.incorrect_count,
      'unanswered_count',  qa.unanswered_count,
      'correct_pct',       ROUND((qa.correct_count::numeric   / NULLIF(qa.total_attempts,0)) * 100, 2),
      'incorrect_pct',     ROUND((qa.incorrect_count::numeric / NULLIF(qa.total_attempts,0)) * 100, 2),
      'unanswered_pct',    ROUND((qa.unanswered_count::numeric/ NULLIF(qa.total_attempts,0)) * 100, 2)
    ) ORDER BY (qa.correct_count::numeric / NULLIF(qa.total_attempts,0)) ASC NULLS LAST
  )
  INTO v_question_analysis
  FROM (
    SELECT
      (q_data->>'question_id')::uuid                               AS question_id,
      MAX(q_data->>'question_content')                             AS question_content,
      COUNT(*)                                                     AS total_attempts,
      COUNT(*) FILTER (WHERE (q_data->>'is_correct')::boolean)     AS correct_count,
      COUNT(*) FILTER (WHERE NOT (q_data->>'is_correct')::boolean
                       AND NOT (q_data->>'is_unanswered')::boolean) AS incorrect_count,
      COUNT(*) FILTER (WHERE (q_data->>'is_unanswered')::boolean)  AS unanswered_count
    FROM exam_results er
    CROSS JOIN jsonb_array_elements(er.result_data->'questions') AS q_data
    WHERE er.exam_id = p_exam_id
    GROUP BY (q_data->>'question_id')::uuid
  ) qa;

  RETURN jsonb_build_object(
    'summary',           v_summary,
    'students',          COALESCE(v_students, '[]'::jsonb),
    'question_analysis', COALESCE(v_question_analysis, '[]'::jsonb)
  );
END;""")
# also declare v_question_analysis
content = content.replace("  v_students jsonb;", "  v_students jsonb;\n  v_question_analysis jsonb;")

# 5. Fix get_leaderboard
content = content.replace("""RETURNS TABLE (
  rank         bigint,
  student_id   uuid,
  full_name    text,
  total_score  numeric,
  percentage   numeric,
  submitted_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_catalog AS $$
BEGIN
  -- Validate leaderboard publication state
  IF NOT EXISTS (
    SELECT 1 FROM exams
    WHERE id = p_exam_id
      AND status IN ('active', 'completed')
      AND (
        settings->>'show_leaderboard_after' = 'always' OR
        (settings->>'show_leaderboard_after' = 'exam_end' AND status = 'completed')
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
  FROM exam_results er""", """RETURNS TABLE (
  rank             bigint,
  student_id       uuid,
  full_name        text,
  total_score      numeric,
  percentage       numeric,
  submitted_at     timestamptz,
  total_submitted  bigint
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_catalog AS $$
BEGIN
  -- Validate leaderboard publication state
  IF NOT EXISTS (
    SELECT 1 FROM exams
    WHERE id = p_exam_id
    AND status IN ('active', 'completed')
    AND (
      settings->>'show_leaderboard_after' = 'submission'
      OR (
        settings->>'show_leaderboard_after' = 'exam_end'
        AND (status = 'completed' OR type = 'practice')
      )
    )
  ) THEN
    RAISE EXCEPTION 'LEADERBOARD_UNAVAILABLE';
  END IF;

  RETURN QUERY
  WITH sub_count AS (
    SELECT COUNT(*) AS n FROM exam_results WHERE exam_id = p_exam_id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY er.percentage DESC, er.computed_at ASC),
    er.student_id,
    sp.full_name,
    er.total_score,
    er.percentage,
    es.submitted_at,
    (SELECT n FROM sub_count)
  FROM exam_results er""")

# 6. create_exam_session validation
content = content.replace("""    RAISE EXCEPTION 'VALIDATION_DUPLICATE_QUESTIONS';
  END IF;

  -- 1. Insert session""", """    RAISE EXCEPTION 'VALIDATION_DUPLICATE_QUESTIONS';
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

  -- 1. Insert session""")

# 9. is_admin() revoke
content = content.replace("GRANT EXECUTE ON FUNCTION is_admin              TO authenticated;", "REVOKE EXECUTE ON FUNCTION is_admin FROM authenticated;")
content = content.replace("GRANT EXECUTE ON FUNCTION is_admin TO authenticated;", "REVOKE EXECUTE ON FUNCTION is_admin FROM authenticated;")

# Also add admin_force_submit_session to the grant list
content = content.replace("GRANT EXECUTE ON FUNCTION submit_exam_session   TO authenticated;", "GRANT EXECUTE ON FUNCTION submit_exam_session   TO authenticated;\nGRANT EXECUTE ON FUNCTION admin_force_submit_session TO authenticated;")


with open('supabase/exam-portal-sql.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done updating exam-portal-sql.py")
