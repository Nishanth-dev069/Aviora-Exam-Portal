-- ==============================================================================
-- AVIORA EXAM PORTAL — PRODUCTION DATA PURGE SCRIPT
-- Purpose: Completely clears all test exams, questions, batches, logs, telemetry,
--          students, and regular admins.
-- Result: ONLY the Super Admin account (role = 'super_admin') is preserved.
-- ==============================================================================

BEGIN;

-- 1. Temporarily disable immutability triggers on audit/results/questions tables
ALTER TABLE audit_logs DISABLE TRIGGER al_immutable;
ALTER TABLE exam_results DISABLE TRIGGER er_immutable;
ALTER TABLE exam_questions DISABLE TRIGGER eq_immutable;

-- 2. Clear all telemetry, proctoring events, and audit logs
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE security_events CASCADE;
TRUNCATE TABLE active_sessions CASCADE;

-- 3. Clear all student submissions, results, and sessions
TRUNCATE TABLE student_answers CASCADE;
TRUNCATE TABLE exam_results CASCADE;
TRUNCATE TABLE exam_sessions CASCADE;
TRUNCATE TABLE exam_enrollments CASCADE;

-- 4. Clear all exams, questions, and question banks
TRUNCATE TABLE exam_questions CASCADE;
TRUNCATE TABLE exams CASCADE;
TRUNCATE TABLE question_options CASCADE;
TRUNCATE TABLE questions CASCADE;
TRUNCATE TABLE question_banks CASCADE;

-- 5. Clear student profiles and batches
TRUNCATE TABLE student_profiles CASCADE;
TRUNCATE TABLE batches CASCADE;

-- 6. Delete all non-superadmin users from the public schema
DELETE FROM public.users 
WHERE role != 'super_admin' 
   OR email != 'superadmin@aviora.com';

-- 7. Delete all non-superadmin users from auth.users
DELETE FROM auth.users 
WHERE email != 'superadmin@aviora.com' 
  AND id NOT IN (SELECT id FROM public.users WHERE role = 'super_admin');

-- 8. Re-enable immutability triggers
ALTER TABLE audit_logs ENABLE TRIGGER al_immutable;
ALTER TABLE exam_results ENABLE TRIGGER er_immutable;
ALTER TABLE exam_questions ENABLE TRIGGER eq_immutable;

COMMIT;

-- ==============================================================================
-- VERIFICATION CHECK
-- ==============================================================================
SELECT 'public.users (Super Admin)' AS entity, count(*) AS count FROM public.users
UNION ALL
SELECT 'auth.users (Super Admin)' AS entity, count(*) AS count FROM auth.users
UNION ALL
SELECT 'exams' AS entity, count(*) AS count FROM exams
UNION ALL
SELECT 'questions' AS entity, count(*) AS count FROM questions
UNION ALL
SELECT 'question_banks' AS entity, count(*) AS count FROM question_banks
UNION ALL
SELECT 'student_profiles' AS entity, count(*) AS count FROM student_profiles
UNION ALL
SELECT 'batches' AS entity, count(*) AS count FROM batches
UNION ALL
SELECT 'audit_logs' AS entity, count(*) AS count FROM audit_logs
UNION ALL
SELECT 'exam_sessions' AS entity, count(*) AS count FROM exam_sessions;
