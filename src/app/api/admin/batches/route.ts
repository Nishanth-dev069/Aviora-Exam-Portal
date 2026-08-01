import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const supabaseAnon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { session }, error: authError } = await supabaseAnon.auth.getSession();
  const user = session?.user ?? null;
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } }
  );

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
    return { error: 'Forbidden', status: 403 };
  }

  return { user, supabaseAdmin };
}

export async function GET(request: Request) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = auth.supabaseAdmin!;
  const url = new URL(request.url);
  
  if (url.searchParams.get('format') === 'simple') {
    const { data: simpleBatches } = await supabaseAdmin
      .from('batches')
      .select('id, name, student_profiles(count)')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    const formatted = (simpleBatches || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      student_count: b.student_profiles?.[0]?.count || 0,
    }));

    return NextResponse.json({ batches: formatted, data: formatted });
  }

  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
  const search = url.searchParams.get('search') || '';
  
  const sortBy = url.searchParams.get('sortBy') || 'name';
  const sortOrder = url.searchParams.get('sortOrder') || 'asc';

  // We need to fetch batches and their student counts.
  // We can do this by selecting from batches and joining student_profiles.
  let query = supabaseAdmin
    .from('batches')
    .select('id, name, description, created_at, student_profiles(count)', { count: 'exact' })
    .is('deleted_at', null);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Format data
  const formattedData = data.map((b: {id: string, name: string, description: string, created_at: string, student_profiles: {count: number}[]}) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    created_at: b.created_at,
    student_count: b.student_profiles[0]?.count || 0
  }));

  return NextResponse.json({ data: formattedData, count, page, pageSize });
}

const createSchema = z.object({
  name: z.string().min(1, 'Batch name is required'),
  description: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = auth.supabaseAdmin!;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
  }

  const { name, description } = parsed.data;

  const { data, error } = await supabaseAdmin.from('batches').insert({
    name,
    description: description || null
  }).select('id').single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Batch created successfully', batchId: data.id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = auth.supabaseAdmin!;
  const adminUser = auth.user!;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'Batch ID is required' }, { status: 400 });

  // Soft delete using NOW()
  const { error } = await supabaseAdmin.from('batches')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit Log
  await supabaseAdmin.from('audit_logs').insert({
    actor_id: adminUser.id,
    actor_role: 'admin',
    action: 'admin.batch_archived',
    resource_type: 'batch',
    resource_id: id,
    ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1'
  });

  return NextResponse.json({ message: 'Batch archived successfully' });
}
