import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { uploadFile, deleteFile } from '@/lib/storage/signed-urls';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    // Verify caller is admin (use service role to bypass RLS)
    const { createClient } = await import('@supabase/supabase-js');
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: caller } = await adminClient
      .from('users')
      .select('role, deleted_at')
      .eq('id', session.user.id)
      .single();

    if (!caller || !['admin', 'super_admin'].includes(caller.role) || caller.deleted_at) {
      return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
    }

    // Verify the target student exists
    const { data: targetStudent } = await adminClient
      .from('student_profiles')
      .select('user_id, photo_url')
      .eq('user_id', params.studentId)
      .single();

    if (!targetStudent) {
      return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
    }

    // Parse multipart form
    const formData = await request.formData();
    const file = formData.get('photo') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No file provided.' } },
        { status: 400 }
      );
    }

    // Validate file
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Only JPEG, PNG, and WebP images are allowed.' } },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'File size must be under 2MB.' } },
        { status: 400 }
      );
    }

    // Delete old photo if exists
    if (targetStudent.photo_url) {
      await deleteFile(targetStudent.photo_url);
    }

    // Upload new photo
    const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
    const storagePath = `${params.studentId}/profile.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const fullPath = await uploadFile('student-photos', storagePath, buffer, file.type);

    if (!fullPath) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Upload failed.' } },
        { status: 500 }
      );
    }

    // Update student_profiles with new storage path
    await adminClient
      .from('student_profiles')
      .update({ photo_url: fullPath, updated_at: new Date().toISOString() })
      .eq('user_id', params.studentId);

    // Audit log (fire and forget)
    adminClient.from('audit_logs').insert({
      actor_id: session.user.id,
      actor_role: caller.role,
      action: 'admin.student_photo_updated',
      resource_type: 'student_profile',
      resource_id: params.studentId,
      metadata: { storage_path: fullPath },
    }).then().catch(console.error);

    return NextResponse.json({ success: true, storage_path: fullPath });

  } catch (error) {
    console.error('[Photo Upload] Error:', error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

// DELETE: Remove photo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: caller } = await adminClient.from('users')
      .select('role').eq('id', session.user.id).single();
    if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
      return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
    }

    const { data: profile } = await adminClient
      .from('student_profiles').select('photo_url').eq('user_id', params.studentId).single();

    if (profile?.photo_url) {
      await deleteFile(profile.photo_url);
      await adminClient.from('student_profiles')
        .update({ photo_url: null, updated_at: new Date().toISOString() })
        .eq('user_id', params.studentId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Photo Delete] Error:', error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
