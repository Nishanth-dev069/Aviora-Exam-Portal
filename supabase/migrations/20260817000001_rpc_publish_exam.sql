-- ============================================================================
-- Migration: Create or Replace rpc_publish_exam
-- Date: 2026-08-17
-- Description:
--   Snapshots questions into exam_questions with random sampling:
--   1. Single-bank: randomly samples total_questions from bank_id.
--   2. Multi-bank: extracts source_bank_ids from settings, calculates proportional
--      share per bank, randomly samples from each bank, and assigns sequential base_order.
--   3. Idempotency guard: raises ALREADY_PUBLISHED if exam_questions already exist.
--   4. Updates exam status and writes audit log.
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_publish_exam(
  p_exam_id  uuid,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exam           exams%ROWTYPE;
  v_source_bank_ids uuid[];
  v_bank_id        uuid;
  v_total_needed   integer;
  v_existing_count integer;

  -- Multi-bank variables
  v_bank_record    RECORD;
  v_bank_avail     integer;
  v_total_avail    integer := 0;
  v_allocated      integer;
  v_remainder      integer;
  v_offset         integer := 0;

  -- Sampling variables
  v_inserted_count integer := 0;
BEGIN
  -- ── 1. Lock the exam row for this transaction ──────────────────────────────
  SELECT * INTO v_exam
  FROM exams
  WHERE id = p_exam_id
  AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXAM_NOT_FOUND: Exam % does not exist.', p_exam_id;
  END IF;

  -- ── 2. Idempotency guard — never double-publish ────────────────────────────
  SELECT COUNT(*) INTO v_existing_count
  FROM exam_questions
  WHERE exam_id = p_exam_id;

  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'ALREADY_PUBLISHED: exam_questions already exist for exam %. Aborting.', p_exam_id;
  END IF;

  -- ── 3. Validate exam state ─────────────────────────────────────────────────
  IF v_exam.status NOT IN ('draft', 'scheduled') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Exam must be in draft or scheduled state to publish. Current: %', v_exam.status;
  END IF;

  v_total_needed := v_exam.total_questions;
  IF v_total_needed <= 0 THEN
    RAISE EXCEPTION 'INVALID_CONFIG: total_questions must be > 0.';
  END IF;

  -- ── 4. Determine source banks ──────────────────────────────────────────────
  -- source_bank_ids from settings JSONB; may be empty array or null
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(
      COALESCE(v_exam.settings -> 'source_bank_ids', '[]'::jsonb)
    )::uuid
  ) INTO v_source_bank_ids;

  IF v_source_bank_ids IS NULL OR array_length(v_source_bank_ids, 1) IS NULL THEN
    -- Single bank mode
    v_source_bank_ids := ARRAY[v_exam.bank_id];
  END IF;

  -- ── 5. SINGLE BANK MODE: exactly one bank in source list ──────────────────
  IF array_length(v_source_bank_ids, 1) = 1 THEN
    v_bank_id := v_source_bank_ids[1];

    -- Verify bank exists and is active
    PERFORM 1 FROM question_banks
    WHERE id = v_bank_id AND status = 'active' AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'BANK_NOT_FOUND: Question bank % is not active.', v_bank_id;
    END IF;

    -- Count available questions
    SELECT COUNT(*) INTO v_bank_avail
    FROM questions
    WHERE bank_id = v_bank_id AND deleted_at IS NULL;

    IF v_bank_avail < v_total_needed THEN
      RAISE EXCEPTION 'INSUFFICIENT_QUESTIONS: Bank % has % questions but exam requires %.', 
        v_bank_id, v_bank_avail, v_total_needed;
    END IF;

    -- Randomly sample v_total_needed questions, assign base_order 1..N
    INSERT INTO exam_questions (id, exam_id, question_id, base_order, marks, created_at)
    SELECT
      gen_random_uuid(),
      p_exam_id,
      q.id,
      ROW_NUMBER() OVER (ORDER BY random())::smallint,
      v_exam.marks_per_question,
      now()
    FROM questions q
    WHERE q.bank_id = v_bank_id
    AND q.deleted_at IS NULL
    ORDER BY random()
    LIMIT v_total_needed;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  -- ── 6. MULTI-BANK MODE: proportional allocation across banks ───────────────
  ELSE
    -- Step 6a: Calculate total available questions across all source banks
    FOR v_bank_record IN
      SELECT qb.id AS bank_id, COUNT(q.id) AS avail_count
      FROM question_banks qb
      JOIN questions q ON q.bank_id = qb.id AND q.deleted_at IS NULL
      WHERE qb.id = ANY(v_source_bank_ids)
      AND qb.status = 'active'
      AND qb.deleted_at IS NULL
      GROUP BY qb.id
    LOOP
      v_total_avail := v_total_avail + v_bank_record.avail_count;
    END LOOP;

    IF v_total_avail < v_total_needed THEN
      RAISE EXCEPTION 'INSUFFICIENT_QUESTIONS: Source banks combined have % questions but exam requires %.', 
        v_total_avail, v_total_needed;
    END IF;

    -- Step 6b: Proportional allocation per bank (floor division; remainder to largest bank)
    -- Insert questions bank by bank with sequential base_order across all banks
    v_offset := 0;
    v_remainder := v_total_needed;

    FOR v_bank_record IN
      SELECT qb.id AS bank_id, COUNT(q.id) AS avail_count
      FROM question_banks qb
      JOIN questions q ON q.bank_id = qb.id AND q.deleted_at IS NULL
      WHERE qb.id = ANY(v_source_bank_ids)
      AND qb.status = 'active'
      AND qb.deleted_at IS NULL
      GROUP BY qb.id
      ORDER BY COUNT(q.id) DESC  -- largest bank first (absorbs rounding remainder)
    LOOP
      -- Proportional share: floor((bank_avail / total_avail) * total_needed)
      -- Minimum 1 per bank, cannot exceed bank's available count
      v_allocated := GREATEST(
        1,
        LEAST(
          v_bank_record.avail_count,
          FLOOR((v_bank_record.avail_count::numeric / v_total_avail) * v_total_needed)::integer
        )
      );

      -- Don't allocate more than what remains
      v_allocated := LEAST(v_allocated, v_remainder);
      IF v_allocated <= 0 THEN
        EXIT; -- Nothing left to allocate
      END IF;

      -- Randomly sample v_allocated questions from this bank
      INSERT INTO exam_questions (id, exam_id, question_id, base_order, marks, created_at)
      SELECT
        gen_random_uuid(),
        p_exam_id,
        q.id,
        (v_offset + ROW_NUMBER() OVER (ORDER BY random()))::smallint,
        v_exam.marks_per_question,
        now()
      FROM questions q
      WHERE q.bank_id = v_bank_record.bank_id
      AND q.deleted_at IS NULL
      ORDER BY random()
      LIMIT v_allocated;

      GET DIAGNOSTICS v_bank_avail = ROW_COUNT; -- reuse var for inserted count
      v_offset    := v_offset + v_bank_avail;
      v_remainder := v_remainder - v_bank_avail;
    END LOOP;

    v_inserted_count := v_offset; -- total inserted across all banks
  END IF;

  -- ── 7. Validate insertion count ────────────────────────────────────────────
  IF v_inserted_count <> v_total_needed THEN
    RAISE EXCEPTION 'INSERTION_MISMATCH: Expected % rows in exam_questions but inserted %. Rolling back.', 
      v_total_needed, v_inserted_count;
  END IF;

  -- ── 8. Update exam status ──────────────────────────────────────────────────
  UPDATE exams
  SET
    status     = CASE WHEN status = 'draft' THEN 
                   CASE WHEN scheduled_at IS NOT NULL THEN 'scheduled' ELSE 'active' END
                 ELSE status END,
    updated_at = now()
  WHERE id = p_exam_id;

  -- ── 9. Write audit log ─────────────────────────────────────────────────────
  INSERT INTO audit_logs (
    id, actor_id, actor_role, action, resource_type, resource_id, metadata, created_at
  )
  SELECT
    gen_random_uuid(),
    p_admin_id,
    u.role,
    'admin.exam_published',
    'exam',
    p_exam_id,
    jsonb_build_object(
      'total_questions_snapshotted', v_inserted_count,
      'source_bank_ids', to_jsonb(v_source_bank_ids)
    ),
    now()
  FROM users u
  WHERE u.id = p_admin_id;

END;
$$;

REVOKE ALL ON FUNCTION rpc_publish_exam(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rpc_publish_exam(uuid, uuid) TO service_role;
