-- Create student-photos storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-photos',
  'student-photos',
  false,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS policy for admins to manage student photos
DROP POLICY IF EXISTS "admins_manage_student_photos" ON storage.objects;
CREATE POLICY "admins_manage_student_photos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'student-photos'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND deleted_at IS NULL
  )
);
