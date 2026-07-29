CREATE OR REPLACE FUNCTION update_force_password_change(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Only allow authenticated user to update their own row
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  UPDATE users
  SET force_password_change = false, updated_at = now()
  WHERE id = p_user_id;

  -- Optional: Audit logging if it aligns with the rest of the architecture
  INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id)
  VALUES (
    p_user_id, 'student', 'user.password_changed', 'user', p_user_id
  );
END;
$$;
