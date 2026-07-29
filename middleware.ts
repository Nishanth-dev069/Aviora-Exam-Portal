import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

async function hashTokenEdge(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  // 1. Device Detection (Block mobile for exam portal)
  const ua = req.headers.get('user-agent') || '';
  const isTabletUA = /iPad|Android(?!.*Mobile)|Tablet/i.test(ua);
  const isMobileUA = /Android.*Mobile|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isMobile = isMobileUA && !isTabletUA;

  if (isMobile && !pathname.startsWith('/device-blocked')) {
    if (isApi) {
      return NextResponse.json(
        { error: { code: 'DEVICE_NOT_ALLOWED', message: 'Examinations require a tablet or desktop computer.' } },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL('/device-blocked', req.url));
  }

  // 2. Allow static assets and Next.js internals
  const isStaticAsset =
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.');

  if (isStaticAsset) return NextResponse.next();

  // 3. Define public routes (including self-authenticating exam endpoints)
  const PUBLIC_ROUTES = [
    '/login',
    '/device-blocked',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/callback',
    '/api/heartbeat',
    '/api/exam/heartbeat',
    '/api/exam/sync',
    '/api/exam/submit',
  ];

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  // 4. Create Supabase client that syncs cookies
  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );

  // 5. Get user session
  const { data: { user } } = await supabase.auth.getUser();

  // If no user session
  if (!user) {
    if (isPublicRoute) return res;

    if (isApi) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
        { status: 401 }
      );
    }

    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirectRes = NextResponse.redirect(loginUrl);
    redirectRes.cookies.delete('aviora_session_token');
    return redirectRes;
  }

  // 6. User authenticated — verify record in users table
  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } }
  );

  const { data: dbUser, error: userError } = await supabaseAdmin
    .from('users')
    .select('role, status, deleted_at, force_password_change')
    .eq('id', user.id)
    .single();

  if (userError || !dbUser) {
    await supabase.auth.signOut();
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', 'session_invalid');
    const redirectRes = NextResponse.redirect(loginUrl);
    redirectRes.cookies.delete('aviora_session_token');
    return redirectRes;
  }

  // 7. Account Status Check (suspended or deleted)
  if (dbUser.deleted_at !== null || dbUser.status === 'suspended' || dbUser.status === 'deactivated') {
    await supabase.auth.signOut();
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', 'account_suspended');
    const redirectRes = NextResponse.redirect(loginUrl);
    redirectRes.cookies.delete('aviora_session_token');
    return redirectRes;
  }

  // 8. Single Active Session Enforcement (for student role)
  if (dbUser.role === 'student') {
    const sessionToken = req.cookies.get('aviora_session_token')?.value;

    if (!sessionToken) {
      await supabase.auth.signOut();
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('error', 'session_invalid');
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.cookies.delete('aviora_session_token');
      return redirectRes;
    }

    const tokenHash = await hashTokenEdge(sessionToken);

    const { data: activeSession } = await supabaseAdmin
      .from('active_sessions')
      .select('id, status, expires_at')
      .eq('user_id', user.id)
      .eq('token_hash', tokenHash)
      .eq('status', 'active')
      .maybeSingle();

    if (!activeSession) {
      if (isApi) {
        return NextResponse.json(
          { error: { code: 'SESSION_TERMINATED', message: 'Your session was terminated because you logged in elsewhere.' } },
          { status: 401 }
        );
      }
      await supabase.auth.signOut();
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('error', 'session_terminated');
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.cookies.delete('aviora_session_token');
      return redirectRes;
    }

    if (new Date(activeSession.expires_at) < new Date()) {
      if (isApi) {
        return NextResponse.json(
          { error: { code: 'SESSION_EXPIRED', message: 'Your session has expired.' } },
          { status: 401 }
        );
      }
      await supabase.auth.signOut();
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('error', 'session_expired');
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.cookies.delete('aviora_session_token');
      return redirectRes;
    }
  }

  // 9. Force Password Change
  if (dbUser.force_password_change && pathname !== '/change-password' && !pathname.startsWith('/api/auth')) {
    if (isApi) {
      return NextResponse.json(
        { error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'You must change your password' } },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL('/change-password', req.url));
  }

  // 10. Role-Based Access Control
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!['admin', 'super_admin'].includes(dbUser.role)) {
      if (isApi) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Access denied.' } },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/exam') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/leaderboard') ||
    pathname.startsWith('/api/student')
  ) {
    if (!['student'].includes(dbUser.role)) {
      if (isApi) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Access denied.' } },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/admin/students', req.url));
    }
  }

  // 11. Public route check for authenticated user
  if (isPublicRoute && pathname === '/login') {
    if (dbUser.role === 'student') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.redirect(new URL('/admin/students', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js)).*)',
  ],
};
