import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

async function getSuperAdminCaller(request: NextRequest) {
  const cookieStore = await cookies();
  const supabaseAnon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { session } } = await supabaseAnon.auth.getSession();
  if (!session?.user) {
    return { error: 'UNAUTHORIZED', status: 401 };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: caller } = await supabaseAdmin
    .from('users')
    .select('id, email, role, deleted_at')
    .eq('id', session.user.id)
    .single();

  if (!caller || caller.role !== 'super_admin' || caller.deleted_at) {
    return { error: 'FORBIDDEN', status: 403 };
  }

  return { caller, supabaseAdmin };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getSuperAdminCaller(request);
    if ('error' in auth) {
      return NextResponse.json({ error: { code: auth.error } }, { status: auth.status });
    }

    const { supabaseAdmin } = auth;

    const { data: admins, error: fetchErr } = await supabaseAdmin
      .from('users')
      .select('id, email, role, status, force_password_change, created_at, updated_at')
      .in('role', ['admin', 'super_admin'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (fetchErr) {
      console.error('[Manage Admins GET Error]', fetchErr);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: fetchErr.message } }, { status: 500 });
    }

    // Fetch active session info for last active times
    const adminIds = (admins || []).map(a => a.id);
    const lastActiveMap: Record<string, string> = {};

    if (adminIds.length > 0) {
      const { data: sessions } = await supabaseAdmin
        .from('active_sessions')
        .select('user_id, last_active_at')
        .in('user_id', adminIds)
        .order('last_active_at', { ascending: false });

      (sessions || []).forEach(s => {
        if (!lastActiveMap[s.user_id]) {
          lastActiveMap[s.user_id] = s.last_active_at;
        }
      });
    }

    const enrichedAdmins = (admins || []).map(a => ({
      ...a,
      last_active_at: lastActiveMap[a.id] || null,
    }));

    return NextResponse.json({ success: true, admins: enrichedAdmins });
  } catch (err: unknown) {
    console.error('[Manage Admins GET Exception]', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Internal error' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getSuperAdminCaller(request);
    if ('error' in auth) {
      return NextResponse.json({ error: { code: auth.error } }, { status: auth.status });
    }

    const { caller, supabaseAdmin } = auth;
    const body = await request.json();
    const { email, password, role = 'admin' } = body;

    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: 'Email and password (min 6 chars) are required' }, { status: 400 });
    }

    if (!['admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Role must be admin or super_admin' }, { status: 400 });
    }

    // Check existing email in users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    // Create in Supabase Auth
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
    });

    if (authErr || !authData.user) {
      console.error('[Manage Admins POST Auth Error]', authErr);
      return NextResponse.json({ error: authErr?.message || 'Failed to create auth user' }, { status: 500 });
    }

    // Insert into users table
    const newAdminId = authData.user.id;
    const { error: insertErr } = await supabaseAdmin
      .from('users')
      .insert({
        id: newAdminId,
        email: email.toLowerCase().trim(),
        role,
        status: 'active',
        force_password_change: true,
      });

    if (insertErr) {
      console.error('[Manage Admins POST Insert Error]', insertErr);
      await supabaseAdmin.auth.admin.deleteUser(newAdminId);
      return NextResponse.json({ error: 'Failed to create user record: ' + insertErr.message }, { status: 500 });
    }

    // Audit log (fire and forget)
    void supabaseAdmin.from('audit_logs').insert({
      actor_id: caller.id,
      actor_role: caller.role,
      action: 'super_admin.admin_created',
      resource_type: 'user',
      resource_id: newAdminId,
      metadata: { created_email: email, role },
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
    }).then(({ error }) => {
      if (error) console.error('[audit_log_error]', error.message);
    });

    return NextResponse.json({ success: true, admin_id: newAdminId, message: 'Admin account created successfully' }, { status: 201 });
  } catch (err: unknown) {
    console.error('[Manage Admins POST Exception]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getSuperAdminCaller(request);
    if ('error' in auth) {
      return NextResponse.json({ error: { code: auth.error } }, { status: auth.status });
    }

    const { caller, supabaseAdmin } = auth;
    const body = await request.json();
    const { action, admin_id } = body;

    if (!action || !admin_id) {
      return NextResponse.json({ error: 'Missing action or admin_id' }, { status: 400 });
    }

    // Verify target exists
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('id, email, role, status')
      .eq('id', admin_id)
      .maybeSingle();

    if (!targetUser || !['admin', 'super_admin'].includes(targetUser.role)) {
      return NextResponse.json({ error: 'Target admin user not found' }, { status: 404 });
    }

    if (action === 'toggle_status') {
      const newStatus = targetUser.status === 'active' ? 'suspended' : 'active';
      const { error: updateErr } = await supabaseAdmin
        .from('users')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', admin_id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      void supabaseAdmin.from('audit_logs').insert({
        actor_id: caller.id,
        actor_role: caller.role,
        action: 'super_admin.admin_status_changed',
        resource_type: 'user',
        resource_id: admin_id,
        metadata: { target_email: targetUser.email, new_status: newStatus },
        ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
      }).then(({ error }) => {
        if (error) console.error('[audit_log_error]', error.message);
      });

      return NextResponse.json({ success: true, new_status: newStatus });
    }

    if (action === 'reset_password') {
      const { password } = body;
      if (!password || password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }

      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(admin_id, { password });
      if (authErr) {
        return NextResponse.json({ error: authErr.message }, { status: 500 });
      }

      await supabaseAdmin.from('users').update({ force_password_change: true }).eq('id', admin_id);

      void supabaseAdmin.from('audit_logs').insert({
        actor_id: caller.id,
        actor_role: caller.role,
        action: 'super_admin.admin_password_reset',
        resource_type: 'user',
        resource_id: admin_id,
        metadata: { target_email: targetUser.email },
        ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
      }).then(({ error }) => {
        if (error) console.error('[audit_log_error]', error.message);
      });

      return NextResponse.json({ success: true, message: 'Password reset successfully' });
    }

    if (action === 'delete_admin') {
      if (admin_id === caller.id) {
        return NextResponse.json({ error: 'You cannot delete your own super admin account' }, { status: 400 });
      }

      const { error: delErr } = await supabaseAdmin
        .from('users')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', admin_id);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      void supabaseAdmin.from('audit_logs').insert({
        actor_id: caller.id,
        actor_role: caller.role,
        action: 'super_admin.admin_deleted',
        resource_type: 'user',
        resource_id: admin_id,
        metadata: { target_email: targetUser.email },
        ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
      }).then(({ error }) => {
        if (error) console.error('[audit_log_error]', error.message);
      });

      return NextResponse.json({ success: true, message: 'Admin deleted successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    console.error('[Manage Admins PATCH Exception]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
