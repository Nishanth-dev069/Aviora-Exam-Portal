CREATE OR REPLACE FUNCTION compute_and_store_result(p_session_id uuid, p_student_id uuid)
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

  v_percentage := CASE
    WHEN v_max_score > 0 THEN ROUND((v_total_score / v_max_score) * 100, 2)
    ELSE 0
  END;

  v_is_passed := CASE
    WHEN v_exam.passing_marks IS NOT NULL THEN v_total_score >= v_exam.passing_marks
    ELSE NULL
  END;

  v_time_taken := LEAST(
    EXTRACT(EPOCH FROM (now() - v_session.started_at))::integer,
    (v_exam.duration_minutes * 60)
  );

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
$$;
