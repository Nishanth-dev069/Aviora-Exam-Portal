CREATE OR REPLACE FUNCTION upsert_question(
  p_question_id uuid,
  p_bank_id uuid,
  p_text text,
  p_subject text,
  p_topic text,
  p_difficulty text,
  p_tags text[],
  p_explanation text,
  p_options jsonb
) RETURNS uuid AS $$
DECLARE
  v_question_id uuid;
  v_correct_count integer;
  v_option record;
BEGIN
  -- 1. Validate exactly 1 correct option in JSON
  SELECT count(*) INTO v_correct_count
  FROM jsonb_array_elements(p_options) AS opt
  WHERE (opt->>'is_correct')::boolean = true;

  IF v_correct_count != 1 THEN
    RAISE EXCEPTION 'Exactly one option must be marked as correct';
  END IF;

  -- 2. Upsert Question
  IF p_question_id IS NULL THEN
    INSERT INTO questions (bank_id, text, subject, topic, difficulty, tags, explanation)
    VALUES (p_bank_id, p_text, p_subject, p_topic, p_difficulty, p_tags, p_explanation)
    RETURNING id INTO v_question_id;
  ELSE
    UPDATE questions
    SET text = p_text,
        subject = p_subject,
        topic = p_topic,
        difficulty = p_difficulty,
        tags = p_tags,
        explanation = p_explanation,
        updated_at = NOW()
    WHERE id = p_question_id
    RETURNING id INTO v_question_id;
    
    IF v_question_id IS NULL THEN
      RAISE EXCEPTION 'Question not found';
    END IF;
  END IF;

  -- 3. Upsert Options
  -- Delete missing options
  DELETE FROM question_options 
  WHERE question_id = v_question_id 
  AND id NOT IN (
    SELECT (opt->>'id')::uuid 
    FROM jsonb_array_elements(p_options) AS opt 
    WHERE opt->>'id' IS NOT NULL
  );

  -- Insert or Update options
  FOR v_option IN SELECT * FROM jsonb_array_elements(p_options)
  LOOP
    IF v_option.value->>'id' IS NULL THEN
      INSERT INTO question_options (question_id, text, is_correct)
      VALUES (v_question_id, v_option.value->>'text', (v_option.value->>'is_correct')::boolean);
    ELSE
      UPDATE question_options
      SET text = v_option.value->>'text',
          is_correct = (v_option.value->>'is_correct')::boolean
      WHERE id = (v_option.value->>'id')::uuid AND question_id = v_question_id;
    END IF;
  END LOOP;

  RETURN v_question_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;
