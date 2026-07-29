CREATE OR REPLACE FUNCTION publish_exam(
  p_exam jsonb,
  p_question_ids uuid[],
  p_student_ids uuid[],
  p_admin_id uuid
) RETURNS uuid AS $$
DECLARE
  v_exam_id uuid;
  v_qid uuid;
  v_sid uuid;
  v_order integer := 1;
  v_marks numeric(5,2);
BEGIN
  -- 1. Insert Exam
  INSERT INTO exams (
    bank_id, title, subject, description, instructions, type, duration_minutes, total_questions,
    marks_per_question, negative_marks, passing_marks, status, scheduled_at, ends_at, settings,
    created_by, updated_by
  ) VALUES (
    (p_exam->>'bank_id')::uuid,
    p_exam->>'title',
    p_exam->>'subject',
    NULLIF(p_exam->>'description', ''),
    NULLIF(p_exam->>'instructions', ''),
    p_exam->>'type',
    (p_exam->>'duration_minutes')::integer,
    (p_exam->>'total_questions')::integer,
    COALESCE((p_exam->>'marks_per_question')::numeric, 1.0),
    COALESCE((p_exam->>'negative_marks')::numeric, 0.0),
    NULLIF(p_exam->>'passing_marks', '')::numeric,
    p_exam->>'status',
    NULLIF(p_exam->>'scheduled_at', '')::timestamptz,
    NULLIF(p_exam->>'ends_at', '')::timestamptz,
    (p_exam->'settings')::jsonb,
    p_admin_id,
    p_admin_id
  ) RETURNING id INTO v_exam_id;

  v_marks := COALESCE((p_exam->>'marks_per_question')::numeric, 1.0);

  -- 2. Insert Exam Questions
  FOREACH v_qid IN ARRAY p_question_ids
  LOOP
    INSERT INTO exam_questions (exam_id, question_id, base_order, marks)
    VALUES (v_exam_id, v_qid, v_order, v_marks);
    v_order := v_order + 1;
  END LOOP;

  -- 3. Insert Exam Enrollments
  FOREACH v_sid IN ARRAY p_student_ids
  LOOP
    INSERT INTO exam_enrollments (exam_id, student_id, enrolled_by)
    VALUES (v_exam_id, v_sid, p_admin_id)
    ON CONFLICT (exam_id, student_id) DO NOTHING;
  END LOOP;

  RETURN v_exam_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;
