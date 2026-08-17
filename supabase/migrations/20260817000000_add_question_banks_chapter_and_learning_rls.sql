-- ============================================================================
-- Migration: Add chapter and chapter_order to question_banks + Learning RLS
-- Date: 2026-08-17
-- Description:
--   Purely additive, idempotent migration for the Learning Section feature.
--   1. Adds `chapter` (text, NULL) and `chapter_order` (smallint, DEFAULT 0).
--   2. Adds partial index `idx_question_banks_chapter` on (subject, chapter_order).
--   3. Adds RLS policy `students_read_active_banks_for_learning` allowing active students
--      to read active banks where chapter IS NOT NULL.
-- ============================================================================

-- Step 1: Add columns with existence guards
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'question_banks' AND column_name = 'chapter'
  ) THEN
    ALTER TABLE question_banks ADD COLUMN chapter text NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'question_banks' AND column_name = 'chapter_order'
  ) THEN
    ALTER TABLE question_banks ADD COLUMN chapter_order smallint NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Step 2: Create index (idempotent — IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_question_banks_chapter
  ON question_banks(subject, chapter_order)
  WHERE deleted_at IS NULL;

-- Step 3: Add RLS policy for student read access
-- Students can only see active, non-deleted banks where chapter IS NOT NULL
-- (chapter IS NOT NULL = admin has explicitly enabled this bank for Learning Section)
-- Students CANNOT see banks where chapter is NULL — those are exam-only banks
-- Students CANNOT see archived banks
-- Students CANNOT read question_banks via any other policy (all other policies are admin-only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'question_banks'
    AND policyname = 'students_read_active_banks_for_learning'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "students_read_active_banks_for_learning" ON question_banks
        FOR SELECT TO authenticated
        USING (
          status = 'active'
          AND deleted_at IS NULL
          AND chapter IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'student'
            AND u.deleted_at IS NULL
            AND u.status = 'active'
          )
        );
    $policy$;
  END IF;
END $$;
