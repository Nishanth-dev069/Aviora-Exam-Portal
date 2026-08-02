import { createClient } from '@supabase/supabase-js';

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Generate a signed URL for a private storage object.
 * @param storagePath - e.g. "student-photos/uuid/profile.jpg"
 * @param expiresInSeconds - default 3600 (1 hour)
 */
export async function getSignedUrl(
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  try {
    if (!storagePath) return null;

    let bucket = 'question-images';
    let filePath = storagePath;

    if (storagePath.startsWith('question-images/')) {
      bucket = 'question-images';
      filePath = storagePath.substring('question-images/'.length);
    } else if (storagePath.startsWith('student-photos/')) {
      bucket = 'student-photos';
      filePath = storagePath.substring('student-photos/'.length);
    } else if (storagePath.includes('/')) {
      const parts = storagePath.split('/');
      if (['question-images', 'student-photos'].includes(parts[0])) {
        bucket = parts[0];
        filePath = parts.slice(1).join('/');
      }
    }

    if (!bucket || !filePath) return null;

    const { data, error } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('[Storage] getSignedUrl exception:', err);
    return null;
  }
}

/**
 * Upload a file to Supabase Storage.
 * Returns the storage path on success.
 */
export async function uploadFile(
  bucket: string,
  filePath: string,
  file: Buffer,
  contentType: string
): Promise<string | null> {
  const { data, error } = await serviceClient.storage
    .from(bucket)
    .upload(filePath, file, {
      contentType,
      upsert: true, // replace if exists
    });

  if (error || !data?.path) {
    console.error('[Storage] Upload failed:', error);
    return null;
  }

  return `${bucket}/${data.path}`;
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(storagePath: string): Promise<void> {
  if (!storagePath) return;
  const [bucket, ...pathParts] = storagePath.split('/');
  const filePath = pathParts.join('/');
  if (!bucket || !filePath) return;
  await serviceClient.storage.from(bucket).remove([filePath]);
}
