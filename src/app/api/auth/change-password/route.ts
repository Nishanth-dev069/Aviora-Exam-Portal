import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { changePasswordSchema } from '@/lib/validators';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = changePasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { current_password, new_password } = result.data;

    const cookieStore = await cookies();

    const supabaseAnon = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          },
        },
      }
    );

    // Verify current password if provided
    if (current_password) {
      const { data: { session } } = await supabaseAnon.auth.getSession();
      const user = session?.user ?? null;
      if (!user || !user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      
      const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
        email: user.email,
        password: current_password
      });

      if (signInError) {
        return NextResponse.json({ error: 'INVALID_PASSWORD' }, { status: 400 });
      }
    }

    const { data: authData, error: updateError } = await supabaseAnon.auth.updateUser({
      password: new_password,
    });

    if (updateError || !authData.user) {
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const userId = authData.user.id;
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';

    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {},
        },
      }
    );

    // Update force_password_change flag in users
    await supabaseAdmin
      .from('users')
      .update({ force_password_change: false })
      .eq('id', userId);

    // Write audit log (fire-and-forget)
    supabaseAdmin.from('audit_logs').insert({
      actor_id: userId,
      actor_role: authData.user.user_metadata?.role || 'student',
      action: 'student.password_changed',
      resource_type: 'user',
      resource_id: userId,
      ip_address: ipAddress,
    }).then().catch(console.error);

    return NextResponse.json({ success: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
