import os

with open('supabase/exam-portal-sql.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_func = """("h3", "FUNCTION: update_force_password_change"),
("body", "Allows an authenticated user to clear their force_password_change flag. Strictly isolated to prevent modifications to other columns or other users."),
("sql", \"\"\"CREATE OR REPLACE FUNCTION update_force_password_change(p_user_id uuid)
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
$$;\"\"\"),

("h3", "FUNCTION: create_exam_session"),"""

content = content.replace('("h3", "FUNCTION: create_exam_session"),', new_func)

with open('supabase/exam-portal-sql.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("update_force_password_change added to exam-portal-sql.py")
