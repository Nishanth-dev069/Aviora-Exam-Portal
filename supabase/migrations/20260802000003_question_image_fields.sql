-- Add image URL columns to questions table
-- These store the Supabase Storage path (not the full signed URL)
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS content_image_url    text NULL,
  ADD COLUMN IF NOT EXISTS explanation_image_url text NULL;

COMMENT ON COLUMN public.questions.content_image_url IS
  'Supabase Storage path for question content image. Format: <bank-id>/<question-id>/content.jpg';

COMMENT ON COLUMN public.questions.explanation_image_url IS
  'Supabase Storage path for explanation image. Format: <bank-id>/<question-id>/explanation.jpg';

-- Create question-images bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-images',
  'question-images',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS policy: Only admins can manage question images
DROP POLICY IF EXISTS "admins_manage_question_images" ON storage.objects;
CREATE POLICY "admins_manage_question_images"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'question-images'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND deleted_at IS NULL
  )
);
