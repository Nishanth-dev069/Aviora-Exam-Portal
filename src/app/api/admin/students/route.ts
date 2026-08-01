import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const supabaseAnon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { session }, error: authError } = await supabaseAnon.auth.getSession();
  const user = session?.user ?? null;
  if (authError || !user) return { error: 'UNAUTHORIZED', status: 401 };

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('role, deleted_at')
    .eq('id', user.id)
    .single();

  if (!userData || !['admin', 'super_admin'].includes(userData.role) || userData.deleted_at) {
    return { error: 'FORBIDDEN', status: 403 };
  }

  return { user };
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (auth.error) {
    return NextResponse.json({ error: { code: auth.error } }, { status: auth.status });
  }

  const url = new URL(request.url);
  
  if (url.searchParams.get('format') === 'simple') {
    const { data: simpleStudents } = await supabaseAdmin
      .from('student_profiles')
      .select('id, user_id, full_name, roll_number, batch_id, batches(name), users!inner(deleted_at)')
      .is('users.deleted_at', null)
      .order('full_name', { ascending: true });

    const formatted = (simpleStudents || []).map((s: any) => ({
      id: s.user_id || s.id,
      full_name: s.full_name,
      roll_number: s.roll_number,
      batch_id: s.batch_id,
      batch_name: s.batches?.name ?? undefined,
    }));

    return NextResponse.json({ students: formatted, data: formatted });
  }

  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
  const search = url.searchParams.get('search') || '';
  const batchFilter = url.searchParams.get('batch') || '';
  const statusFilter = url.searchParams.get('status') || '';
  
  const sortBy = url.searchParams.get('sortBy') || 'created_at';
  const sortOrder = url.searchParams.get('sortOrder') || 'desc';

  let query = supabaseAdmin
    .from('student_profiles')
    .select(`
      id,
      user_id,
      full_name,
      roll_number,
      phone,
      photo_url,
      batch_id,
      created_at,
      users!inner (
        id,
        email,
        role,
        status,
        force_password_change,
        created_at,
        updated_at,
        deleted_at
      ),
      batches (
        id,
        name
      )
    `, { count: 'exact' })
    .eq('users.role', 'student')
    .is('users.deleted_at', null);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,roll_number.ilike.%${search}%`);
  }
  
  if (batchFilter && batchFilter !== 'all') {
    query = query.eq('batch_id', batchFilter);
  }
  
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('users.status', statusFilter);
  }

  if (sortBy === 'status') {
    query = query.order('status', { foreignTable: 'users', ascending: sortOrder === 'asc' });
  } else if (sortBy !== 'last_login') {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: students, error, count } = await query;
  
  if (error) {
    console.error('[Admin Students GET]', error);
    return NextResponse.json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch students: ' + error.message }
    }, { status: 500 });
  }

  const rawList = students ?? [];
  const studentIds = rawList.map((s: any) => s.user_id || s.id).filter(Boolean);

  // Fetch Auth users to get exact last_sign_in_at from Supabase Auth
  const lastLoginMap = new Map<string, string | null>();
  try {
    const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authUsersData?.users) {
      authUsersData.users.forEach(u => {
        if (u.last_sign_in_at) {
          lastLoginMap.set(u.id, u.last_sign_in_at);
        }
      });
    }
  } catch (authErr) {
    console.error('[Admin Students GET - listUsers]', authErr);
  }

  // Query active_sessions for last_active_at across ALL sessions for these students
  const lastActiveMap: Record<string, string> = {};
  try {
    const { data: sessions } = studentIds.length > 0
      ? await supabaseAdmin
          .from('active_sessions')
          .select('user_id, last_active_at, created_at')
          .in('user_id', studentIds)
          .order('last_active_at', { ascending: false })
      : { data: [] };

    (sessions || []).forEach((sess: any) => {
      const activeAt = sess.last_active_at || sess.created_at;
      if (activeAt) {
        if (!lastActiveMap[sess.user_id] || activeAt > lastActiveMap[sess.user_id]) {
          lastActiveMap[sess.user_id] = activeAt;
        }
      }
    });
  } catch (sessErr) {
    console.error('[Admin Students GET - activeSessions]', sessErr);
  }

  // Attach last_active_at and last_login to each student user object
  let formattedList = rawList.map((s: any) => {
    const lastActive = lastActiveMap[s.user_id] || lastLoginMap.get(s.user_id) || null;
    return {
      ...s,
      last_active_at: lastActive,
      users: s.users ? {
        ...s.users,
        last_active_at: lastActive,
        last_login: lastActive
      } : null
    };
  });

  // Handle sorting by last_active_at / last_login if requested
  if (sortBy === 'last_login' || sortBy === 'last_active_at') {
    formattedList.sort((a: any, b: any) => {
      const aTime = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
      const bTime = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
      return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
    });
  }

  return NextResponse.json({
    students: formattedList,
    data: formattedList,
    count: count ?? formattedList.length,
    page,
    pageSize
  });
}

const createSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address (e.g. student@gmail.com)'),
  roll_number: z.string().min(1, 'Roll number is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  temporary_password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  batch_id: z.string().uuid('Invalid batch').nullable().optional(),
  phone: z.string()
    .nullable()
    .optional()
    .refine(
      (val) => !val || /^\+?[0-9]{7,15}$/.test(val),
      'Phone number must be 7–15 digits, optionally starting with +'
    ),
  photo_url: z.string().url().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (auth.error) {
    return NextResponse.json({ error: { code: auth.error } }, { status: auth.status });
  }

  const adminUser = auth.user!;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please fix the highlighted fields.',
        details: parsed.error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }
    }, { status: 400 });
  }

  const { full_name, email, roll_number, password, temporary_password, batch_id, phone, photo_url } = parsed.data;
  const userPassword = password || temporary_password;

  if (!userPassword) {
    return NextResponse.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Password is required.',
        details: [{ field: 'password', message: 'Password is required' }]
      }
    }, { status: 400 });
  }

  // Step 1: Check existing email
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id, deleted_at, status')
    .eq('email', email)
    .maybeSingle();

  if (existingUser && !existingUser.deleted_at) {
    return NextResponse.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please fix the highlighted fields.',
        details: [{ field: 'email', message: 'A student with this email already exists.' }]
      }
    }, { status: 400 });
  }

  if (existingUser && existingUser.deleted_at) {
    // Soft-deleted user — restore them
    await supabaseAdmin.from('users').update({
      deleted_at: null,
      status: 'active',
      force_password_change: true
    }).eq('id', existingUser.id);

    await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: userPassword, email_confirm: true });

    await supabaseAdmin.from('student_profiles').upsert({
      user_id: existingUser.id,
      full_name,
      roll_number,
      batch_id: batch_id || null,
      phone: phone || null,
      photo_url: photo_url || null
    });

    return NextResponse.json({ success: true, restored: true, student_id: existingUser.id, studentId: existingUser.id }, { status: 200 });
  }

  // Step 2: Check roll_number uniqueness
  const { data: existingRoll } = await supabaseAdmin
    .from('student_profiles')
    .select('user_id, users!inner(deleted_at)')
    .eq('roll_number', roll_number)
    .is('users.deleted_at', null)
    .maybeSingle();

  if (existingRoll) {
    return NextResponse.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please fix the highlighted fields.',
        details: [{ field: 'roll_number', message: 'Roll number already exists' }]
      }
    }, { status: 400 });
  }

  // Step 3: Create Supabase Auth user
  const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: userPassword,
    email_confirm: true,
  });

  if (authCreateError || !authData.user) {
    console.error('[Create Student Auth]', authCreateError);
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create login account: ' + (authCreateError?.message || 'Unknown error')
      }
    }, { status: 500 });
  }

  const newUserId = authData.user.id;

  // Step 4: Insert into users table
  const { error: usersError } = await supabaseAdmin
    .from('users')
    .insert({
      id: newUserId,
      email,
      role: 'student',
      status: 'active',
      force_password_change: true,
    });

  if (usersError) {
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    console.error('[Create Student Users Row]', usersError);
    return NextResponse.json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to save student record: ' + usersError.message }
    }, { status: 500 });
  }

  // Step 5: Insert into student_profiles table
  const { error: profileError } = await supabaseAdmin
    .from('student_profiles')
    .insert({
      user_id: newUserId,
      full_name,
      roll_number,
      batch_id: batch_id || null,
      phone: phone || null,
      photo_url: null,
    });

  if (profileError) {
    await supabaseAdmin.from('users').delete().eq('id', newUserId);
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    console.error('[Create Student Profile]', profileError);
    return NextResponse.json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to save student profile: ' + profileError.message }
    }, { status: 500 });
  }

  // Write audit log
  await supabaseAdmin.from('audit_logs').insert({
    actor_id: adminUser.id,
    actor_role: 'admin',
    action: 'admin.student_created',
    resource_type: 'user',
    resource_id: newUserId,
    metadata: { email, roll_number },
    ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1'
  });

  return NextResponse.json({ success: true, student_id: newUserId, studentId: newUserId }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin();
  if (auth.error) {
    return NextResponse.json({ error: { code: auth.error } }, { status: auth.status });
  }

  const adminUser = auth.user!;
  const body = await request.json();
  const { action, student_id } = body;

  if (!action || !student_id) {
    return NextResponse.json({ error: 'Missing action or student_id' }, { status: 400 });
  }

  if (action === 'update_profile') {
    const { full_name, batch_id, phone } = body;
    const { error } = await supabaseAdmin.from('student_profiles').update({
      full_name, batch_id, phone
    }).eq('user_id', student_id);
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: 'Profile updated' });
  }
  
  if (action === 'toggle_status') {
    const { status } = body;
    const { error } = await supabaseAdmin.from('users').update({ status }).eq('id', student_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: adminUser.id,
      actor_role: 'admin',
      action: 'admin.student_status_changed',
      resource_type: 'user',
      resource_id: student_id,
      metadata: { new_status: status },
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1'
    });
    
    return NextResponse.json({ message: 'Status updated' });
  }

  if (action === 'reset_password') {
    const { password } = body;
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(student_id, { password });
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });
    
    const { error: usrErr } = await supabaseAdmin.from('users').update({ force_password_change: true }).eq('id', student_id);
    if (usrErr) return NextResponse.json({ error: usrErr.message }, { status: 500 });
    
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: adminUser.id,
      actor_role: 'admin',
      action: 'admin.password_reset',
      resource_type: 'user',
      resource_id: student_id,
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1'
    });
    
    return NextResponse.json({ message: 'Password reset' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (auth.error) {
    return NextResponse.json({ error: { code: auth.error } }, { status: auth.status });
  }

  const adminUser = auth.user!;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { student_id } = body;
  if (!student_id) {
    return NextResponse.json({ error: 'Missing student_id' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', student_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: adminUser.id,
    actor_role: 'admin',
    action: 'admin.student_deleted',
    resource_type: 'user',
    resource_id: student_id,
    ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1'
  });

  return NextResponse.json({ success: true, message: 'Student deleted successfully' });
}

