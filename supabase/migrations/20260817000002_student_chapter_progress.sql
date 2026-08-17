-- ============================================================================
-- Migration: Add student_chapter_progress table & RLS policies
-- Date: 2026-08-17
-- Description:
--   Tracks student study chapter completion in the Learning section.
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_chapter_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_id uuid NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  questions_completed integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, bank_id)
);

CREATE INDEX IF NOT EXISTS idx_student_chapter_progress_student 
ON student_chapter_progress(student_id, bank_id);

-- Enable RLS
ALTER TABLE student_chapter_progress ENABLE ROW LEVEL SECURITY;

-- Students can read their own progress
DROP POLICY IF EXISTS "students_read_own_chapter_progress" ON student_chapter_progress;
CREATE POLICY "students_read_own_chapter_progress"
ON student_chapter_progress
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Students can insert/update their own progress
DROP POLICY IF EXISTS "students_upsert_own_chapter_progress" ON student_chapter_progress;
CREATE POLICY "students_upsert_own_chapter_progress"
ON student_chapter_progress
FOR ALL
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());
