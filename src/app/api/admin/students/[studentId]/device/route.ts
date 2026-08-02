import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const cookieStore = await cookies();
    const supabaseAnon = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );

    const { data: { session } } = await supabaseAnon.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify caller is admin
    const { data: caller } = await adminClient
      .from('users')
      .select('role, deleted_at')
      .eq('id', session.user.id)
      .single();

    if (!caller || !['admin', 'super_admin'].includes(caller.role) || caller.deleted_at) {
      return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
    }

    // Verify target is a student
    const { data: targetUser } = await adminClient
      .from('users')
      .select('role')
      .eq('id', params.studentId)
      .single();

    if (!targetUser || targetUser.role !== 'student') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Device management only applies to student accounts.' } },
        { status: 400 }
      );
    }

    // Clear device registration
    const { error: clearError } = await adminClient
      .from('student_profiles')
      .update({
        registered_device_id:   null,
        registered_device_info: null,
        updated_at:             new Date().toISOString(),
      })
      .eq('user_id', params.studentId);

    if (clearError) {
      console.error('[Device Clear] Error:', clearError);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: clearError.message } }, { status: 500 });
    }

    // Audit log (fire and forget)
    void (async () => {
      try {
        await adminClient.from('audit_logs').insert({
          actor_id:      session.user.id,
          actor_role:    caller.role,
          action:        'admin.student_device_cleared',
          resource_type: 'student_profile',
          resource_id:   params.studentId,
          metadata:      { cleared_by: session.user.id, cleared_at: new Date().toISOString() },
          ip_address:    request.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1',
        });
      } catch (e) { console.error('[Audit] student_device_cleared', e); }
    })();

    return NextResponse.json({
      success: true,
      message: 'Device registration cleared. The student can now log in from any device and a new device will be registered.',
    });
  } catch (error: any) {
    console.error('[Device Clear] Unhandled:', error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
