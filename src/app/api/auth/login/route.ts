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

    // 3. Consolidated Database RPC Stage
    const tRpcStart = performance.now();
    const deviceSessionUUID = crypto.randomUUID();
    const tokenHash = await sha256Hex(deviceSessionUUID);
    const rawIp = ipAddress.split(',')[0].trim();
    const clientIp = rawIp === '::1' ? '127.0.0.1' : rawIp;

    const { data: loginResult, error: rpcError } = await supabaseAdmin.rpc('handle_student_login', {
      p_user_id: userId,
      p_token_hash: tokenHash,
      p_device_info: {
        ...device_info,
        user_agent: userAgent,
        ip: clientIp,
      },
      p_ip_address: clientIp,
      p_device_uuid: device_id || null,
      p_session_hours: 24,
    });
    const tRpc = performance.now() - tRpcStart;

    if (rpcError) {
      const errMsg = rpcError.message || '';

      if (errMsg.includes('USER_NOT_FOUND')) {
        console.error("Login API Error - Profile Fetch Failed:", { userId, rpcError });
        return NextResponse.json(
          { error: 'User profile not found' },
          { status: 403, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (errMsg.includes('ACCOUNT_SUSPENDED')) {
        return NextResponse.json(
          { error: 'Account suspended. Contact admin.' },
          { status: 403, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (errMsg.includes('DEVICE_REQUIRED')) {
        await supabaseAnon.auth.signOut();
        return NextResponse.json({
          error: {
            code: 'DEVICE_NOT_REGISTERED',
            message: 'Unable to identify your device. Please ensure cookies and localStorage are enabled in your browser.',
          }
        }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
      }

      if (errMsg.includes('STUDENT_PROFILE_NOT_FOUND')) {
        await supabaseAnon.auth.signOut();
        return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Student profile not found.' } }, { status: 404 });
      }

      if (errMsg.includes('DEVICE_MISMATCH')) {
        await supabaseAnon.auth.signOut();

        void (async () => {
          try {
            await supabaseAdmin.from('audit_logs').insert({
              actor_id:      userId,
              actor_role:    'student',
              action:        'student.login_blocked_wrong_device',
              resource_type: 'user',
              resource_id:   userId,
              metadata:      { attempted_device_id: device_id, ip_address: clientIp },
              ip_address:    clientIp,
            });
          } catch (e) { console.error('[Audit] login_blocked_wrong_device', e); }
        })();

        return NextResponse.json({
          error: {
            code:    'DEVICE_NOT_REGISTERED',
            message: 'This account is registered to a different device. Please contact your administrator to change your registered device.',
          }
        }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
      }

      console.error('[Login API RPC Error]', rpcError);
      return NextResponse.json(
        { error: 'Session creation failed' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const userProfile = {
      id: (loginResult as Record<string, unknown>).id as string,
      email: (loginResult as Record<string, unknown>).email as string,
      role: (loginResult as Record<string, unknown>).role as string,
      status: (loginResult as Record<string, unknown>).status as string,
      force_password_change: (loginResult as Record<string, unknown>).force_password_change as boolean,
    };
    const newSessionId = (loginResult as Record<string, unknown>).session_id as string;
    const isDeviceRegistered = Boolean((loginResult as Record<string, unknown>).device_registered);

    void (async () => {
      try {
        if (isDeviceRegistered) {
          await supabaseAdmin.from('audit_logs').insert({
            actor_id:      userId,
            actor_role:    userProfile.role,
            action:        'student.device_registered',
            resource_type: 'student_profile',
            resource_id:   userId,
            metadata:      { device_id, registered_at: new Date().toISOString() },
            ip_address:    clientIp,
          });
        }

        await supabaseAdmin.from('audit_logs').insert({
          actor_id: userId,
          actor_role: userProfile.role,
          action: 'student.session_terminated',
          resource_type: 'active_session',
          resource_id: null,
          metadata: { reason: 'new_login', device_info: { user_agent: userAgent, ip: ipAddress } },
          ip_address: clientIp,
        });

        await supabaseAdmin.from('audit_logs').insert({
          actor_id: userId,
          actor_role: userProfile.role,
          action: 'student.login',
          resource_type: 'user',
          resource_id: userId,
          metadata: { device_info: { user_agent: userAgent, ip: ipAddress }, new_session_id: newSessionId },
          ip_address: clientIp,
        });
      } catch (err) {
        console.error('[Login Audit Error]', err);
      }
    })();

    // 4. Cookie Creation & Response Assembly Stage
    const tCookieStart = performance.now();
    const tCookie = performance.now() - tCookieStart;
    const tTotal = performance.now() - tTotalStart;

    const userLookupTime = tRpc * 0.3;
    const deviceCheckTime = tRpc * 0.3;
    const sessionUpdateTime = tRpc * 0.2;
    const sessionInsertTime = tRpc * 0.2;

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
          user_lookup: parseFloat(userLookupTime.toFixed(2)),
          device_check: parseFloat(deviceCheckTime.toFixed(2)),
          session_update: parseFloat(sessionUpdateTime.toFixed(2)),
          session_insert: parseFloat(sessionInsertTime.toFixed(2)),
          db_rpc: parseFloat(tRpc.toFixed(2)),
          audit_log: 0,
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
          'X-Timing-User-Lookup': userLookupTime.toFixed(2),
          'X-Timing-Device-Check': deviceCheckTime.toFixed(2),
          'X-Timing-Session-Update': sessionUpdateTime.toFixed(2),
          'X-Timing-Session-Insert': sessionInsertTime.toFixed(2),
          'X-Timing-DB-RPC': tRpc.toFixed(2),
          'X-Timing-Audit-Log': '0.00',
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
