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
  
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
  const search = url.searchParams.get('search') || '';
  
  const sortBy = url.searchParams.get('sortBy') || 'name';
  const sortOrder = url.searchParams.get('sortOrder') || 'asc';

  let query = supabaseAdmin
    .from('question_banks')
    .select('id, name, subject, created_at, questions(count)', { count: 'exact' })
    .is('deleted_at', null)
    .is('questions.deleted_at', null); // only count active questions

  if (search) {
    query = query.or(`name.ilike.%${search}%,subject.ilike.%${search}%`);
  }

  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const formattedData = data.map((b: { id: string; name: string; subject: string; created_at: string; questions: { count: number }[] }) => ({
    id: b.id,
    name: b.name,
    subject: b.subject,
    created_at: b.created_at,
    question_count: b.questions[0]?.count || 0
  }));

  return NextResponse.json({ data: formattedData, count, page, pageSize });
}

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  subject: z.string().min(1, 'Subject is required'),
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

  const { name, subject } = parsed.data;

  const { data, error } = await supabaseAdmin.from('question_banks').insert({
    name,
    subject,
    created_by: auth.user!.id
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Question Bank created successfully', id: data.id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = auth.supabaseAdmin!;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  // 404 check
  const { data: existing } = await supabaseAdmin.from('question_banks').select('id').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Question Bank not found' }, { status: 404 });

  const { error } = await supabaseAdmin.from('question_banks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Question bank archived' });
}

export async function PATCH(request: Request) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = auth.supabaseAdmin!;
  const body = await request.json();
  const { id, name, subject } = body;

  if (!id || !name || !subject) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('question_banks')
    .update({ name, subject })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Question Bank updated' });
}
