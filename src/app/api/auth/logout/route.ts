import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: NextRequest) {
  try {
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

    const { data: { session } } = await supabaseAnon.auth.getSession();
    const user = session?.user ?? null;

    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll() { return []; }, setAll() {} } }
    );

    if (user) {
      const sessionToken = request.cookies.get('aviora_session_token')?.value;

      if (sessionToken) {
        const tokenHash = await hashToken(sessionToken);
        await supabaseAdmin
          .from('active_sessions')
          .update({ status: 'terminated', updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('token_hash', tokenHash);
      }

      await supabaseAdmin
        .from('active_sessions')
        .update({ status: 'terminated', updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('status', 'active');

      // Audit log write (fire-and-forget)
      supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id,
        actor_role: 'student',
        action: 'student.logout',
        resource_type: 'user',
        resource_id: user.id,
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1',
      }).then().catch(console.error);

      await supabaseAnon.auth.signOut({ scope: 'local' });
    }

    const response = NextResponse.json({ success: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });

    // Clear session cookie
    response.cookies.set('aviora_session_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });

    if (process.env.ENABLE_PROFILING === 'true') {
      const requestId = request.headers.get('x-request-id') || 'unknown';
      const isRsc = request.headers.get('rsc') === '1' || (request.headers.get('accept') || '').includes('text/x-component');
      console.log(`[IDENTITY_TRACE]\nRequest ID: ${requestId}\nLayer: auth_logout\nOrigin: route_handler\nPath: /api/auth/logout\nMethod: POST\nIs RSC: ${isRsc}\nSource: Supabase Auth signOut\nUser ID: ${user?.id || 'none'}\nEmail: ${user?.email || 'N/A'}\nTimestamp: ${new Date().toISOString()}`);
    }

    return response;
  } catch (err) {
    console.error('[Logout API Error]', err);
    const response = NextResponse.json({ success: true }, { status: 200 });
    response.cookies.set('aviora_session_token', '', { maxAge: 0, path: '/' });
    return response;
  }
}
