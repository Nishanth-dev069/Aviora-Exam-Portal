-- Migration: Add handle_student_login RPC function to consolidate login DB operations
-- Reduces 4 HTTP PostgREST round trips into 1 transactional RPC call (~852ms -> ~50-100ms)

CREATE OR REPLACE FUNCTION public.handle_student_login(
  p_user_id          uuid,
  p_token_hash       text,
  p_device_info      jsonb,
  p_ip_address       inet,
  p_device_uuid      text,
  p_session_hours    integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_student_profile RECORD;
  v_session_id uuid;
  v_device_registered boolean := false;
  v_existing_device_info jsonb;
  v_client_ip text;
  v_now_iso text;
BEGIN
  -- Format current timestamp as ISO 8601 string for device_info JSON
  v_now_iso := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_client_ip := host(p_ip_address);

  -- 1. User Lookup
  SELECT id, email, role, status, force_password_change, deleted_at
  INTO v_user
  FROM users
  WHERE id = p_user_id;

  IF NOT FOUND OR v_user.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  -- 2. Check User Status
  IF v_user.status IN ('suspended', 'deactivated') THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED';
  END IF;

  -- 3. Device Check Stage for Students
  IF v_user.role = 'student' THEN
    IF p_device_uuid IS NULL OR length(trim(p_device_uuid)) < 10 THEN
      RAISE EXCEPTION 'DEVICE_REQUIRED';
    END IF;

    SELECT registered_device_id, registered_device_info
    INTO v_student_profile
    FROM student_profiles
    WHERE user_id = p_user_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'STUDENT_PROFILE_NOT_FOUND';
    END IF;

    IF v_student_profile.registered_device_id IS NULL THEN
      -- First student login: register device UUID and device metadata
      UPDATE student_profiles
      SET
        registered_device_id = p_device_uuid,
        registered_device_info = COALESCE(p_device_info, '{}'::jsonb) || jsonb_build_object(
          'user_agent', COALESCE(p_device_info->>'user_agent', ''),
          'ip_address', v_client_ip,
          'registered_at', v_now_iso,
          'last_login_at', v_now_iso
        ),
        updated_at = now()
      WHERE user_id = p_user_id;

      v_device_registered := true;
    ELSIF v_student_profile.registered_device_id <> p_device_uuid THEN
      RAISE EXCEPTION 'DEVICE_MISMATCH';
    ELSE
      -- Device matches: update last_login_at in registered_device_info
      v_existing_device_info := COALESCE(v_student_profile.registered_device_info, '{}'::jsonb);
      UPDATE student_profiles
      SET
        registered_device_info = jsonb_set(
          v_existing_device_info,
          '{last_login_at}',
          to_jsonb(v_now_iso)
        ),
        updated_at = now()
      WHERE user_id = p_user_id;
    END IF;
  END IF;

  -- 4. Terminate active sessions
  UPDATE active_sessions
  SET
    status = 'terminated',
    updated_at = now()
  WHERE user_id = p_user_id AND status = 'active';

  -- 5. Insert new active session
  INSERT INTO active_sessions (
    user_id,
    token_hash,
    device_info,
    ip_address,
    status,
    last_active_at,
    expires_at
  ) VALUES (
    p_user_id,
    p_token_hash,
    p_device_info,
    p_ip_address,
    'active',
    now(),
    now() + (p_session_hours || ' hours')::interval
  )
  RETURNING id INTO v_session_id;

  -- 6. Return JSON payload
  RETURN jsonb_build_object(
    'id', v_user.id,
    'email', v_user.email,
    'role', v_user.role,
    'status', v_user.status,
    'force_password_change', v_user.force_password_change,
    'session_id', v_session_id,
    'device_registered', v_device_registered
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.handle_student_login(uuid, text, jsonb, inet, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_student_login(uuid, text, jsonb, inet, text, integer) TO authenticated, anon;
