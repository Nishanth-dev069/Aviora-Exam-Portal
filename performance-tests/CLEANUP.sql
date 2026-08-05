-- ==============================================================================
-- AVIORA EXAMINATION PORTAL - PERFORMANCE TEST CLEANUP SCRIPT
-- ==============================================================================
-- Description: Safely purges all test student records, sessions, answers,
-- audit logs, and results generated during performance testing.
-- Schema, triggers, and production data remain untouched.
-- ==============================================================================

DO $$
DECLARE
    v_test_user_ids UUID[];
    v_deleted_users INT := 0;
BEGIN
    -- 1. Identify all test user IDs across public.users and auth.users
    SELECT ARRAY_AGG(id) INTO v_test_user_ids
    FROM (
        SELECT id FROM public.users WHERE email LIKE '%@test.com' OR email LIKE '%@avioratest.com'
        UNION
        SELECT id FROM auth.users WHERE email LIKE '%@test.com' OR email LIKE '%@avioratest.com'
    ) combined_users;

    IF v_test_user_ids IS NULL OR array_length(v_test_user_ids, 1) IS NULL THEN
        RAISE NOTICE 'No performance test accounts found to cleanup.';
        RETURN;
    END IF;

    -- 2. Delete dependent student data
    DELETE FROM public.answers WHERE session_id IN (SELECT id FROM public.exam_sessions WHERE student_id = ANY(v_test_user_ids));
    DELETE FROM public.security_events WHERE session_id IN (SELECT id FROM public.exam_sessions WHERE student_id = ANY(v_test_user_ids));
    DELETE FROM public.results WHERE student_id = ANY(v_test_user_ids);
    DELETE FROM public.exam_sessions WHERE student_id = ANY(v_test_user_ids);
    DELETE FROM public.active_sessions WHERE user_id = ANY(v_test_user_ids);
    DELETE FROM public.audit_logs WHERE actor_id = ANY(v_test_user_ids);
    DELETE FROM public.student_profiles WHERE user_id = ANY(v_test_user_ids) OR roll_number LIKE 'TEST-ROLL-%';
    DELETE FROM public.users WHERE id = ANY(v_test_user_ids);

    -- 3. Delete Supabase Auth internal engine records
    DELETE FROM auth.identities WHERE user_id = ANY(v_test_user_ids);
    DELETE FROM auth.sessions WHERE user_id = ANY(v_test_user_ids);
    DELETE FROM auth.users WHERE id = ANY(v_test_user_ids);
    GET DIAGNOSTICS v_deleted_users = ROW_COUNT;

    RAISE NOTICE 'Cleanup complete! Deleted % test student auth accounts.', v_deleted_users;
END $$;
