-- AVIORA PERFORMANCE RPC CONSOLIDATION & PG_CRON MIGRATION

-- 1. PG_CRON EXTENSION & EXAM STATUS SYNC
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION sync_exam_statuses_scheduled()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE exams SET status = 'active', updated_at = now()
  WHERE type = 'scheduled' AND status = 'scheduled'
    AND scheduled_at <= now() AND (ends_at IS NULL OR ends_at > now()) AND deleted_at IS NULL;

  UPDATE exams SET status = 'completed', updated_at = now()
  WHERE type = 'scheduled' AND status = 'active'
    AND ends_at IS NOT NULL AND ends_at <= now() AND deleted_at IS NULL;

  UPDATE exam_sessions SET status = 'expired', updated_at = now()
  WHERE status = 'active' AND expires_at <= now();
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('aviora-sync-exam-statuses', '* * * * *', 'SELECT sync_exam_statuses_scheduled()');
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;


-- 2. STUDENT DASHBOARD RPC
CREATE OR REPLACE FUNCTION student_get_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  RETURN jsonb_build_object(
    'serverTime', v_now_iso,
    'profile', (
      SELECT jsonb_build_object(
        'id', sp.id,
        'full_name', COALESCE(sp.full_name, 'Student'),
        'roll_number', COALESCE(sp.roll_number, 'Unassigned'),
        'photo_url', sp.photo_url,
        'batch_name', b.name
      )
      FROM student_profiles sp
      LEFT JOIN batches b ON b.id = sp.batch_id
      WHERE sp.user_id = v_caller_id
      LIMIT 1
    ),
    'practiceExams', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'title', e.title,
          'subject', e.subject,
          'type', e.type,
          'duration_minutes', e.duration_minutes,
          'total_questions', e.total_questions,
          'marks_per_question', e.marks_per_question,
          'negative_marks', e.negative_marks,
          'settings', e.settings,
          'status', e.status,
          'scheduled_at', e.scheduled_at,
          'ends_at', e.ends_at
        ) ORDER BY e.created_at DESC
      ), '[]'::jsonb)
      FROM exams e
      WHERE e.type = 'practice' AND e.status = 'active' AND e.deleted_at IS NULL
    ),
    'scheduledExams', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'title', e.title,
          'subject', e.subject,
          'type', e.type,
          'duration_minutes', e.duration_minutes,
          'total_questions', e.total_questions,
          'marks_per_question', e.marks_per_question,
          'negative_marks', e.negative_marks,
          'status', e.status,
          'scheduled_at', e.scheduled_at,
          'ends_at', e.ends_at,
          'settings', e.settings,
          'deleted_at', e.deleted_at
        ) ORDER BY e.scheduled_at DESC NULLS LAST
      ), '[]'::jsonb)
      FROM exam_enrollments ee
      JOIN exams e ON e.id = ee.exam_id
      WHERE ee.student_id = v_caller_id
        AND e.type = 'scheduled'
        AND e.status IN ('scheduled', 'active', 'completed')
        AND e.deleted_at IS NULL
    ),
    'recentResults', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', er.id,
          'session_id', er.session_id,
          'exam_id', er.exam_id,
          'percentage', er.percentage,
          'total_score', er.total_score,
          'max_score', er.max_score,
          'correct_count', er.correct_count,
          'incorrect_count', er.incorrect_count,
          'is_passed', er.is_passed,
          'computed_at', er.computed_at,
          'exams', jsonb_build_object(
            'id', e.id,
            'title', e.title,
            'subject', e.subject,
            'type', e.type
          )
        ) ORDER BY er.computed_at DESC
      ), '[]'::jsonb)
      FROM (
        SELECT * FROM exam_results
        WHERE student_id = v_caller_id
        ORDER BY computed_at DESC
        LIMIT 5
      ) er
      JOIN exams e ON e.id = er.exam_id
    ),
    'sessions', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', es.id,
          'exam_id', es.exam_id,
          'status', es.status,
          'started_at', es.started_at,
          'submitted_at', es.submitted_at,
          'expires_at', es.expires_at
        ) ORDER BY es.created_at DESC
      ), '[]'::jsonb)
      FROM exam_sessions es
      WHERE es.student_id = v_caller_id
    ),
    'sessionResults', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', er.id,
          'session_id', er.session_id,
          'exam_id', er.exam_id,
          'percentage', er.percentage,
          'total_score', er.total_score,
          'correct_count', er.correct_count,
          'incorrect_count', er.incorrect_count,
          'is_passed', er.is_passed
        )
      ), '[]'::jsonb)
      FROM exam_results er
      WHERE er.student_id = v_caller_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION student_get_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION student_get_dashboard() TO authenticated;


-- 3. STUDENT EXAMS RPC
CREATE OR REPLACE FUNCTION student_get_exams()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  RETURN jsonb_build_object(
    'practiceExams', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'title', e.title,
          'subject', e.subject,
          'type', e.type,
          'duration_minutes', e.duration_minutes,
          'total_questions', e.total_questions,
          'marks_per_question', e.marks_per_question,
          'negative_marks', e.negative_marks,
          'status', e.status,
          'settings', e.settings
        ) ORDER BY e.created_at DESC
      ), '[]'::jsonb)
      FROM exams e
      WHERE e.type = 'practice' AND e.status = 'active' AND e.deleted_at IS NULL
    ),
    'scheduledExams', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'title', e.title,
          'subject', e.subject,
          'type', e.type,
          'duration_minutes', e.duration_minutes,
          'total_questions', e.total_questions,
          'marks_per_question', e.marks_per_question,
          'negative_marks', e.negative_marks,
          'status', e.status,
          'scheduled_at', e.scheduled_at,
          'ends_at', e.ends_at,
          'settings', e.settings,
          'deleted_at', e.deleted_at
        ) ORDER BY e.scheduled_at DESC NULLS LAST
      ), '[]'::jsonb)
      FROM exam_enrollments ee
      JOIN exams e ON e.id = ee.exam_id
      WHERE ee.student_id = v_caller_id
        AND e.type = 'scheduled'
        AND e.status IN ('scheduled', 'active', 'completed')
        AND e.deleted_at IS NULL
    ),
    'sessions', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', es.id,
          'exam_id', es.exam_id,
          'status', es.status,
          'started_at', es.started_at,
          'submitted_at', es.submitted_at,
          'expires_at', es.expires_at
        ) ORDER BY es.created_at DESC
      ), '[]'::jsonb)
      FROM exam_sessions es
      WHERE es.student_id = v_caller_id
    ),
    'results', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', er.id,
          'session_id', er.session_id,
          'exam_id', er.exam_id,
          'percentage', er.percentage,
          'total_score', er.total_score,
          'correct_count', er.correct_count,
          'incorrect_count', er.incorrect_count,
          'is_passed', er.is_passed,
          'computed_at', er.computed_at
        )
      ), '[]'::jsonb)
      FROM exam_results er
      WHERE er.student_id = v_caller_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION student_get_exams() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION student_get_exams() TO authenticated;


-- 4. STUDENT ANALYTICS RPC
CREATE OR REPLACE FUNCTION student_get_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', er.id,
        'session_id', er.session_id,
        'exam_id', er.exam_id,
        'percentage', er.percentage,
        'total_score', er.total_score,
        'max_score', er.max_score,
        'correct_count', er.correct_count,
        'incorrect_count', er.incorrect_count,
        'unanswered_count', er.unanswered_count,
        'time_taken_seconds', er.time_taken_seconds,
        'is_passed', er.is_passed,
        'computed_at', er.computed_at,
        'exams', jsonb_build_object(
          'id', e.id,
          'title', e.title,
          'subject', e.subject,
          'type', e.type,
          'total_questions', e.total_questions,
          'duration_minutes', e.duration_minutes
        )
      ) ORDER BY er.computed_at ASC
    ), '[]'::jsonb)
    FROM exam_results er
    JOIN exams e ON e.id = er.exam_id
    WHERE er.student_id = v_caller_id
  );
END;
$$;

REVOKE ALL ON FUNCTION student_get_analytics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION student_get_analytics() TO authenticated;


-- 5. STUDENT LEADERBOARD RPC
CREATE OR REPLACE FUNCTION student_get_leaderboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_batch_id uuid;
  v_batch_name text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT sp.batch_id, b.name INTO v_batch_id, v_batch_name
  FROM student_profiles sp
  LEFT JOIN batches b ON b.id = sp.batch_id
  WHERE sp.user_id = v_caller_id;

  IF v_batch_id IS NULL THEN
    RETURN jsonb_build_object(
      'leaderboard', '[]'::jsonb,
      'currentStudentId', v_caller_id,
      'batchName', NULL,
      'notInBatch', true
    );
  END IF;

  RETURN jsonb_build_object(
    'currentStudentId', v_caller_id,
    'batchName', COALESCE(v_batch_name, 'Your Batch'),
    'notInBatch', false,
    'students', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'user_id', sp.user_id,
          'full_name', sp.full_name,
          'roll_number', sp.roll_number,
          'email', u.email
        )
      ), '[]'::jsonb)
      FROM student_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE sp.batch_id = v_batch_id AND u.deleted_at IS NULL
    ),
    'results', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'student_id', er.student_id,
          'exam_id', er.exam_id,
          'percentage', er.percentage,
          'exam_type', e.type
        )
      ), '[]'::jsonb)
      FROM exam_results er
      JOIN exams e ON e.id = er.exam_id
      JOIN student_profiles sp ON sp.user_id = er.student_id
      WHERE sp.batch_id = v_batch_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION student_get_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION student_get_leaderboard() TO authenticated;


-- 6. EXAM SYNC RPC
CREATE OR REPLACE FUNCTION sync_exam_answers(
  p_session_id          uuid,
  p_sync_id             uuid,
  p_answers             jsonb,
  p_security_events     jsonb DEFAULT '[]'::jsonb,
  p_security_violations integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  uuid := auth.uid();
  v_session    record;
  v_answer     jsonb;
  v_event      jsonb;
  v_accepted   jsonb := '[]'::jsonb;
  v_prev_viol  integer;
  v_events_cnt integer;
  v_new_viol   integer;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT id, student_id, status, expires_at, security_violations, question_order
  INTO   v_session
  FROM   exam_sessions
  WHERE  id = p_session_id AND student_id = v_caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_FORBIDDEN';
  END IF;

  IF v_session.status != 'active' THEN
    RAISE EXCEPTION 'SESSION_TERMINATED';
  END IF;

  IF v_session.expires_at < now() THEN
    UPDATE exam_sessions SET status = 'expired', updated_at = now() WHERE id = p_session_id;
    RAISE EXCEPTION 'SESSION_TERMINATED';
  END IF;

  -- Answers Upsert
  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    INSERT INTO student_answers (
      session_id, question_id, selected_option_id,
      is_marked_for_review, is_visited, time_spent_seconds, updated_at
    )
    VALUES (
      p_session_id,
      (v_answer->>'question_id')::uuid,
      NULLIF(v_answer->>'selected_option_id', '')::uuid,
      COALESCE((v_answer->>'is_marked_for_review')::boolean, false),
      COALESCE((v_answer->>'is_visited')::boolean, true),
      COALESCE((v_answer->>'time_spent_seconds')::integer, 0),
      COALESCE((v_answer->>'updated_at')::timestamptz, now())
    )
    ON CONFLICT (session_id, question_id) DO UPDATE SET
      selected_option_id   = EXCLUDED.selected_option_id,
      is_marked_for_review = EXCLUDED.is_marked_for_review,
      is_visited           = EXCLUDED.is_visited,
      time_spent_seconds   = EXCLUDED.time_spent_seconds,
      updated_at           = EXCLUDED.updated_at;

    v_accepted := v_accepted || jsonb_build_array(v_answer->>'question_id');
  END LOOP;

  -- Security Events Insert
  IF jsonb_array_length(p_security_events) > 0 THEN
    FOR v_event IN SELECT * FROM jsonb_array_elements(p_security_events)
    LOOP
      INSERT INTO security_events (
        session_id, event_type, occurred_at, duration_seconds, event_data
      )
      VALUES (
        p_session_id,
        v_event->>'event_type',
        COALESCE((v_event->>'occurred_at')::timestamptz, now()),
        (v_event->>'duration_seconds')::integer,
        COALESCE(v_event->'event_data', '{}'::jsonb)
      );
    END LOOP;
  END IF;

  v_prev_viol  := COALESCE(v_session.security_violations, 0);
  v_events_cnt := jsonb_array_length(p_security_events);
  v_new_viol   := GREATEST(v_prev_viol + v_events_cnt, COALESCE(p_security_violations, 0));

  UPDATE exam_sessions
  SET    last_synced_at      = now(),
         security_violations = v_new_viol,
         updated_at          = now()
  WHERE  id = p_session_id;

  RETURN jsonb_build_object(
    'accepted',            v_accepted,
    'security_violations', v_new_viol,
    'server_time',         to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END;
$$;

REVOKE ALL ON FUNCTION sync_exam_answers(uuid, uuid, jsonb, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sync_exam_answers(uuid, uuid, jsonb, jsonb, integer) TO authenticated;


-- 7. ADMIN GET STUDENTS RPC
CREATE OR REPLACE FUNCTION admin_get_students(
  p_search      text    DEFAULT NULL,
  p_batch_id    uuid    DEFAULT NULL,
  p_status      text    DEFAULT NULL,
  p_page        integer DEFAULT 1,
  p_page_size   integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_offset    integer := (p_page - 1) * p_page_size;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = v_caller_id AND role IN ('admin','super_admin') AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN jsonb_build_object(
    'students', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',           sp.id,
          'user_id',      u.id,
          'full_name',    sp.full_name,
          'roll_number',  sp.roll_number,
          'phone',        sp.phone,
          'photo_url',    sp.photo_url,
          'batch_id',     sp.batch_id,
          'created_at',   sp.created_at,
          'users', jsonb_build_object(
            'id',                    u.id,
            'email',                 u.email,
            'role',                  u.role,
            'status',                u.status,
            'force_password_change', u.force_password_change,
            'created_at',            u.created_at,
            'updated_at',            u.updated_at,
            'deleted_at',           u.deleted_at
          ),
          'batches', CASE WHEN b.id IS NOT NULL THEN jsonb_build_object('id', b.id, 'name', b.name) ELSE NULL END
        ) ORDER BY sp.created_at DESC
      ), '[]'::jsonb)
      FROM   users u
      JOIN   student_profiles sp ON sp.user_id = u.id
      LEFT   JOIN batches b ON b.id = sp.batch_id
      WHERE  u.role       = 'student'
        AND  u.deleted_at IS NULL
        AND  (p_search IS NULL OR p_search = '' OR sp.full_name ILIKE '%' || p_search || '%' OR sp.roll_number ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%')
        AND  (p_batch_id IS NULL OR sp.batch_id = p_batch_id)
        AND  (p_status   IS NULL OR p_status = '' OR p_status = 'all' OR u.status = p_status)
      LIMIT  p_page_size
      OFFSET v_offset
    ),
    'count', (
      SELECT COUNT(*)
      FROM   users u
      JOIN   student_profiles sp ON sp.user_id = u.id
      WHERE  u.role       = 'student'
        AND  u.deleted_at IS NULL
        AND  (p_search IS NULL OR p_search = '' OR sp.full_name ILIKE '%' || p_search || '%' OR sp.roll_number ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%')
        AND  (p_batch_id IS NULL OR sp.batch_id = p_batch_id)
        AND  (p_status   IS NULL OR p_status = '' OR p_status = 'all' OR u.status = p_status)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_get_students(text, uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_students(text, uuid, text, integer, integer) TO authenticated;


-- 8. ADMIN GET EXAM MONITORING RPC
CREATE OR REPLACE FUNCTION admin_get_exam_monitoring(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = v_caller_id AND role IN ('admin','super_admin') AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN jsonb_build_object(
    'exam', (
      SELECT jsonb_build_object(
        'id', e.id, 'title', e.title, 'subject', e.subject,
        'status', e.status, 'scheduled_at', e.scheduled_at,
        'ends_at', e.ends_at, 'duration_minutes', e.duration_minutes,
        'total_questions', e.total_questions
      )
      FROM exams e WHERE e.id = p_exam_id AND e.deleted_at IS NULL
    ),
    'students', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'student_id',    u.id,
          'full_name',     sp.full_name,
          'roll_number',   sp.roll_number,
          'session_id',    es.id,
          'session_status', COALESCE(es.status, 'not_started'),
          'started_at',    es.started_at,
          'submitted_at',  es.submitted_at,
          'expires_at',    es.expires_at,
          'last_synced_at', es.last_synced_at,
          'security_violations', COALESCE(es.security_violations, 0),
          'answers_count', (
            SELECT COUNT(*) FROM student_answers sa
            WHERE sa.session_id = es.id AND sa.selected_option_id IS NOT NULL
          ),
          'percentage',    er.percentage
        ) ORDER BY sp.full_name ASC
      ), '[]'::jsonb)
      FROM exam_enrollments ee
      JOIN users u ON u.id = ee.student_id
      JOIN student_profiles sp ON sp.user_id = u.id
      LEFT JOIN exam_sessions es ON es.exam_id = p_exam_id AND es.student_id = u.id
                                AND es.status IN ('active','submitted','expired')
      LEFT JOIN exam_results er ON er.session_id = es.id
      WHERE ee.exam_id = p_exam_id
    ),
    'summary', jsonb_build_object(
      'total_enrolled',  (SELECT COUNT(*) FROM exam_enrollments WHERE exam_id = p_exam_id),
      'not_started',     (SELECT COUNT(*) FROM exam_enrollments ee
                          WHERE ee.exam_id = p_exam_id
                            AND NOT EXISTS (SELECT 1 FROM exam_sessions es
                                            WHERE es.exam_id = p_exam_id AND es.student_id = ee.student_id)),
      'in_progress',     (SELECT COUNT(*) FROM exam_sessions WHERE exam_id = p_exam_id AND status = 'active'),
      'submitted',       (SELECT COUNT(*) FROM exam_sessions WHERE exam_id = p_exam_id AND status = 'submitted'),
      'average_score',   (SELECT ROUND(AVG(percentage), 2) FROM exam_results WHERE exam_id = p_exam_id)
    ),
    'server_time', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_get_exam_monitoring(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_exam_monitoring(uuid) TO authenticated;
