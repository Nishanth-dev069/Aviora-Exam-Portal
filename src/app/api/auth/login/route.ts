import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { loginSchema } from '@/lib/validators';
import { cookies } from 'next/headers';
import { sha256Hex } from '@/lib/auth/hash';

export async function POST(request: Request) {
  const tTotalStart = performance.now();
  try {
    // 1. Validation Stage
    const tValidationStart = performance.now();
    const body = await request.json();
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const tValidation = performance.now() - tValidationStart;

    const { email, password } = result.data;
    const device_id: string | undefined = typeof body.device_id === 'string' ? body.device_id : undefined;
    const device_info: Record<string, unknown> = (typeof body.device_info === 'object' && body.device_info !== null) ? body.device_info : {};

    // 2. Supabase Auth Stage
    const tAuthStart = performance.now();
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

    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });
    const tAuth = performance.now() - tAuthStart;

    if (authError || !authData.session) {
      console.log("=== RAW SUPABASE AUTH ERROR OBJECT ===");
      console.log("authError keys/props:", authError ? Object.getOwnPropertyNames(authError) : []);
      console.log("authError status:", authError?.status);
      console.log("authError name:", authError?.name);
      console.log("authError message:", authError?.message);
      console.log("authError full:", JSON.stringify(authError, Object.getOwnPropertyNames(authError || {}), 2));
      console.log("======================================");

      const isRateLimit = authError?.status === 429;
      const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
      
      if (isRateLimit) {
        headers['Retry-After'] = '60';
        headers['X-RateLimit-Limit'] = '30';
        headers['X-RateLimit-Remaining'] = '0';
      }

      console.log(`[LOGIN_PERF_FAILED] Auth Failed | Duration: ${(performance.now() - tTotalStart).toFixed(1)}ms | Status: ${isRateLimit ? 429 : 401}`);
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

    // 3. User Lookup Stage
    const tUserLookupStart = performance.now();
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, status, deleted_at, force_password_change')
      .eq('id', userId)
      .single();
    const tUserLookup = performance.now() - tUserLookupStart;

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

    // 4. Device Check Stage
    const tDeviceCheckStart = performance.now();
    if (userProfile.role === 'student') {
      if (!device_id || device_id.length < 10) {
        await supabaseAnon.auth.signOut();
        return NextResponse.json({
          error: {
            code: 'DEVICE_NOT_REGISTERED',
            message: 'Unable to identify your device. Please ensure cookies and localStorage are enabled in your browser.',
          }
        }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
      }

      const { data: profile } = await supabaseAdmin
        .from('student_profiles')
        .select('registered_device_id, registered_device_info')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile) {
        await supabaseAnon.auth.signOut();
        return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Student profile not found.' } }, { status: 404 });
      }

      if (profile.registered_device_id === null || profile.registered_device_id === undefined) {
        const rawIp = ipAddress.split(',')[0].trim();
        const clientIp = rawIp === '::1' ? '127.0.0.1' : rawIp;
        const deviceInfoToStore = {
          ...device_info,
          user_agent:    userAgent,
          ip_address:    clientIp,
          registered_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
        };

        const { error: registerError } = await supabaseAdmin
          .from('student_profiles')
          .update({
            registered_device_id:   device_id,
            registered_device_info: deviceInfoToStore,
            updated_at:             new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (registerError) {
          console.error('[Login] Failed to register device:', registerError);
        }

        void (async () => {
          try {
            await supabaseAdmin.from('audit_logs').insert({
              actor_id:      userId,
              actor_role:    userProfile.role,
              action:        'student.device_registered',
              resource_type: 'student_profile',
              resource_id:   userId,
              metadata:      { device_id, registered_at: deviceInfoToStore.registered_at },
              ip_address:    clientIp,
            });
          } catch (e) { console.error('[Audit] device_registered', e); }
        })();

      } else if (profile.registered_device_id !== device_id) {
        await supabaseAnon.auth.signOut();

        void (async () => {
          try {
            await supabaseAdmin.from('audit_logs').insert({
              actor_id:      userId,
              actor_role:    userProfile.role,
              action:        'student.login_blocked_wrong_device',
              resource_type: 'user',
              resource_id:   userId,
              metadata:      { attempted_device_id: device_id, ip_address: ipAddress.split(',')[0] },
              ip_address:    ipAddress.split(',')[0],
            });
          } catch (e) { console.error('[Audit] login_blocked_wrong_device', e); }
        })();

        return NextResponse.json({
          error: {
            code:    'DEVICE_NOT_REGISTERED',
            message: 'This account is registered to a different device. Please contact your administrator to change your registered device.',
          }
        }, { status: 403, headers: { 'Cache-Control': 'no-store' } });

      } else {
        void (async () => {
          try {
            const existingInfo = (typeof profile.registered_device_info === 'object' && profile.registered_device_info !== null)
              ? profile.registered_device_info as Record<string, unknown>
              : {};
            await supabaseAdmin
              .from('student_profiles')
              .update({
                registered_device_info: { ...existingInfo, last_login_at: new Date().toISOString() },
                updated_at:             new Date().toISOString(),
              })
              .eq('user_id', userId);
          } catch (e) { console.error('[Login] Failed to update last_login_at', e); }
        })();
      }
    }
    const tDeviceCheck = performance.now() - tDeviceCheckStart;

    // 5. Active Session Update / Termination Stage
    const tSessionUpdateStart = performance.now();
    const { error: terminateError } = await supabaseAdmin
      .from('active_sessions')
      .update({
        status: 'terminated',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active');
    const tSessionUpdate = performance.now() - tSessionUpdateStart;

    if (terminateError) {
      console.error('[Login] Failed to terminate old sessions:', terminateError);
    }

    // 6. Audit Log Dispatch Stage
    const tAuditLogStart = performance.now();
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
    const tAuditLog = performance.now() - tAuditLogStart;

    // 7. Session Creation Stage
    const tSessionCreationStart = performance.now();
    const deviceSessionUUID = crypto.randomUUID();
    const tokenHash = await sha256Hex(deviceSessionUUID);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

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
    const tSessionCreation = performance.now() - tSessionCreationStart;

    if (sessionError || !newSession) {
      console.error('[Login] Failed to create active session:', sessionError);
      return NextResponse.json(
        { error: 'Session creation failed' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

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

    // 8. Cookie Creation & Response Assembly Stage
    const tCookieStart = performance.now();
    const tCookie = performance.now() - tCookieStart;
    const tTotal = performance.now() - tTotalStart;

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
        timing: {
          validation: parseFloat(tValidation.toFixed(2)),
          supabase_auth: parseFloat(tAuth.toFixed(2)),
          user_lookup: parseFloat(tUserLookup.toFixed(2)),
          device_check: parseFloat(tDeviceCheck.toFixed(2)),
          session_update: parseFloat(tSessionUpdate.toFixed(2)),
          session_insert: parseFloat(tSessionCreation.toFixed(2)),
          audit_log: parseFloat(tAuditLog.toFixed(2)),
          cookie_creation: parseFloat(tCookie.toFixed(2)),
          total: parseFloat(tTotal.toFixed(2)),
        }
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Timing-Validation': tValidation.toFixed(2),
          'X-Timing-Supabase-Auth': tAuth.toFixed(2),
          'X-Timing-User-Lookup': tUserLookup.toFixed(2),
          'X-Timing-Device-Check': tDeviceCheck.toFixed(2),
          'X-Timing-Session-Update': tSessionUpdate.toFixed(2),
          'X-Timing-Session-Insert': tSessionCreation.toFixed(2),
          'X-Timing-Audit-Log': tAuditLog.toFixed(2),
          'X-Timing-Total': tTotal.toFixed(2),
        },
      }
    );

    cookieStore.getAll().forEach((c) => {
      response.cookies.set(c.name, c.value);
    });

    response.cookies.set('aviora-device-session', deviceSessionUUID, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
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
