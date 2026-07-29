import os
import re

with open('supabase/exam-portal-sql.py', 'r', encoding='utf-8') as f:
    content = f.read()

validations = """BEGIN
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

  -- Insert the exam session with exception-based concurrency control"""

content = content.replace("BEGIN\n  -- Insert the exam session with exception-based concurrency control", validations)

with open('supabase/exam-portal-sql.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Validations added to create_exam_session")
