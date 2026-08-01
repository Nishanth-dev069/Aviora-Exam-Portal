import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { loginSchema } from '@/lib/validators';
import { cookies } from 'next/headers';

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { email, password } = result.data;

    const cookieStore = await cookies();

    // Anon client for signInWithPassword
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

    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      const isRateLimit = authError?.status === 429;
      const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
      
      if (isRateLimit) {
        headers['Retry-After'] = '60';
        headers['X-RateLimit-Limit'] = '30';
        headers['X-RateLimit-Remaining'] = '0';
      }

      return NextResponse.json(
        { error: isRateLimit ? 'Too many login attempts. Please try again later.' : 'Invalid email or password' },
        { status: isRateLimit ? 429 : 401, headers }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const userId = authData.user.id;
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || '';

    // Fetch user profile
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, status, deleted_at, force_password_change')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      console.error("Login API Error - Profile Fetch Failed:", { userId, profileError });
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (userProfile.status === 'suspended' || userProfile.status === 'deactivated' || userProfile.deleted_at !== null) {
      return NextResponse.json(
        { error: 'Account suspended. Contact admin.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // STEP 4: Terminate ALL existing active sessions for this user FIRST (before creating new one)
    const { error: terminateError } = await supabaseAdmin
      .from('active_sessions')
      .update({
        status: 'terminated',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (terminateError) {
      console.error('[Login] Failed to terminate old sessions:', terminateError);
      // Non-fatal — continue
    }

    // STEP 5: Write audit log for terminated sessions (fire and forget)
    void (async () => {
      try {
        await supabaseAdmin.from('audit_logs').insert({
          actor_id: userId,
          actor_role: userProfile.role,
          action: 'student.session_terminated',
          resource_type: 'active_session',
          resource_id: null,
          metadata: { reason: 'new_login', device_info: { user_agent: userAgent, ip: ipAddress } },
          ip_address: ipAddress.split(',')[0],
        });
      } catch (err) {
        console.error('[Login Audit Error - Terminate]', err);
      }
    })();

    // STEP 6: Create new active_sessions row for Device B (after terminating all old ones)
    const sessionToken = crypto.randomUUID();
    const tokenHash = await hashToken(sessionToken);
    const expiresAt = new Date(
      authData.session.expires_at ? authData.session.expires_at * 1000 : Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: newSession, error: sessionError } = await supabaseAdmin
      .from('active_sessions')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        device_info: {
          user_agent: userAgent,
          ip: ipAddress,
        },
        ip_address: ipAddress.split(',')[0],
        status: 'active',
        last_active_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (sessionError || !newSession) {
      console.error('[Login] Failed to create active session:', sessionError);
      return NextResponse.json(
        { error: 'Session creation failed' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // STEP 7: Write login audit log (fire and forget)
    void (async () => {
      try {
        await supabaseAdmin.from('audit_logs').insert({
          actor_id: userId,
          actor_role: userProfile.role,
          action: 'student.login',
          resource_type: 'user',
          resource_id: userId,
          metadata: { device_info: { user_agent: userAgent, ip: ipAddress }, new_session_id: newSession.id },
          ip_address: ipAddress.split(',')[0],
        });
      } catch (err) {
        console.error('[Login Audit Error - Login]', err);
      }
    })();

    // STEP 8: Return success & synchronize cookies
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: userProfile.id,
          email: userProfile.email,
          role: userProfile.role,
          force_password_change: userProfile.force_password_change,
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
        },
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );

    // Sync cookies from store and set session token cookie
    cookieStore.getAll().forEach((c) => {
      response.cookies.set(c.name, c.value);
    });

    response.cookies.set('aviora_session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    if (process.env.ENABLE_PROFILING === 'true') {
      const requestId = request.headers.get('x-request-id') || 'unknown';
      const isRsc = request.headers.get('rsc') === '1' || (request.headers.get('accept') || '').includes('text/x-component');
      console.log(`[IDENTITY_TRACE]\nRequest ID: ${requestId}\nLayer: auth_login\nOrigin: route_handler\nPath: /api/auth/login\nMethod: POST\nIs RSC: ${isRsc}\nSource: signInWithPassword & users table\nUser ID: ${userProfile.id}\nEmail: ${userProfile.email}\nRole: ${userProfile.role}\nTimestamp: ${new Date().toISOString()}`);
    }

    return response;
  } catch (err) {
    console.error('[Login API Internal Error]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
