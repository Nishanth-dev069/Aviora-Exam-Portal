/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { uploadFile, deleteFile } from '@/lib/storage/signed-urls';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function getAdminClient() {
  const cookieStore = await cookies();
  const supabaseAnon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { session }, error: authError } = await supabaseAnon.auth.getSession();
  const user = session?.user ?? null;
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } }
  );

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('role, deleted_at')
    .eq('id', user.id)
    .single();

  if (!userData || !['admin', 'super_admin'].includes(userData.role) || userData.deleted_at) {
    return { error: 'Forbidden', status: 403 };
  }

  return { user, role: userData.role, supabaseAdmin };
}

// POST: Upload an image for a question (content or explanation)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await params;
    const auth = await getAdminClient();
    if (auth.error) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: auth.error } }, { status: auth.status });
    }

    const { user, role, supabaseAdmin } = auth;

    // Verify question exists and get bank_id & existing image URLs
    const { data: question, error: qErr } = await supabaseAdmin
      .from('questions')
      .select('id, bank_id, content_image_url, explanation_image_url')
      .eq('id', questionId)
      .is('deleted_at', null)
      .maybeSingle();

    if (qErr || !question) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Question not found' } }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const imageType = formData.get('image_type') as 'content' | 'explanation' | null;

    if (!file || !imageType || !['content', 'explanation'].includes(imageType)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Provide image file and image_type (content or explanation).' } },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Only JPEG, PNG, and WebP images are allowed.' } },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'File must be under 5MB.' } },
        { status: 400 }
      );
    }

    // Delete old image of this type if exists
    const oldPath = imageType === 'content'
      ? question.content_image_url
      : question.explanation_image_url;
    if (oldPath) {
      await deleteFile(oldPath).catch(console.error);
    }

    // Upload new file
    const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
    const storagePath = `${question.bank_id}/${questionId}/${imageType}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const fullPath = await uploadFile('question-images', storagePath, buffer, file.type);

    if (!fullPath) {
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Upload failed.' } }, { status: 500 });
    }

    // Update questions table
    const updateField = imageType === 'content'
      ? { content_image_url: fullPath }
      : { explanation_image_url: fullPath };

    await supabaseAdmin
      .from('questions')
      .update({ ...updateField, updated_at: new Date().toISOString() })
      .eq('id', questionId);

    // Write audit log
    supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id,
      actor_role: role,
      action: 'admin.question_image_updated',
      resource_type: 'question',
      resource_id: questionId,
      metadata: { image_type: imageType, storage_path: fullPath },
    }).then().catch(console.error);

    return NextResponse.json({ success: true, storage_path: fullPath });

  } catch (error) {
    console.error('[Question Image Upload]', error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }, { status: 500 });
  }
}

// DELETE: Remove a question image (content or explanation)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await params;
    const auth = await getAdminClient();
    if (auth.error) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: auth.error } }, { status: auth.status });
    }

    const { supabaseAdmin } = auth;
    const body = await request.json();
    const imageType = body.image_type as 'content' | 'explanation';

    if (!imageType || !['content', 'explanation'].includes(imageType)) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Provide valid image_type' } }, { status: 400 });
    }

    const { data: question } = await supabaseAdmin
      .from('questions')
      .select('content_image_url, explanation_image_url')
      .eq('id', questionId)
      .single();

    const pathToDelete = imageType === 'content'
      ? question?.content_image_url
      : question?.explanation_image_url;

    if (pathToDelete) {
      await deleteFile(pathToDelete).catch(console.error);
      const clearField = imageType === 'content'
        ? { content_image_url: null }
        : { explanation_image_url: null };

      await supabaseAdmin
        .from('questions')
        .update({ ...clearField, updated_at: new Date().toISOString() })
        .eq('id', questionId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Question Image Delete]', error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }, { status: 500 });
  }
}
