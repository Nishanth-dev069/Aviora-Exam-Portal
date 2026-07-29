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
      await supabaseAnon.auth.signOut();
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (userProfile.status === 'suspended' || userProfile.status === 'deactivated' || userProfile.deleted_at !== null) {
      await supabaseAnon.auth.signOut();
      return NextResponse.json(
        { error: 'Account suspended. Contact admin.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Terminate existing active sessions for this user (single device enforcement)
    await supabaseAdmin
      .from('active_sessions')
      .update({
        status: 'terminated',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    // Issue unique session token
    const sessionToken = crypto.randomUUID();
    const tokenHash = await hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin.from('active_sessions').insert({
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
    });

    // Write audit log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: userId,
      actor_role: userProfile.role,
      action: 'student.login',
      resource_type: 'user',
      resource_id: userId,
      ip_address: ipAddress.split(',')[0],
    });

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
        },
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );

    // Set session token as HttpOnly, Secure, SameSite=Strict cookie
    response.cookies.set('aviora_session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[Login API Internal Error]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
