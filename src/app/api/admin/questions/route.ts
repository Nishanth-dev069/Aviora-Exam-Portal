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
  if (auth.error) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: auth.error } }, { status: auth.status });

  const supabaseAdmin = auth.supabaseAdmin!;
  const url = new URL(request.url);
  
  const bankId = url.searchParams.get('bankId');
  if (!bankId) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Bank ID is required' } }, { status: 400 });

  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
  const search = url.searchParams.get('search') || '';
  
  const topicFilter = url.searchParams.get('topic') || '';
  const difficultyFilter = url.searchParams.get('difficulty') || '';

  const sortBy = url.searchParams.get('sortBy') || 'created_at';
  const sortOrder = url.searchParams.get('sortOrder') || 'desc';

  let query = supabaseAdmin
    .from('questions')
    .select('id, bank_id, content, text:content, subject, topic, difficulty, tags, explanation, created_at, question_options(id, content, text:content, is_correct, display_order)', { count: 'exact' })
    .eq('bank_id', bankId)
    .is('deleted_at', null);

  if (search) {
    query = query.ilike('content', `%${search}%`);
  }
  
  if (topicFilter && topicFilter !== 'all') {
    query = query.eq('topic', topicFilter);
  }
  
  if (difficultyFilter && difficultyFilter !== 'all') {
    query = query.ilike('difficulty', difficultyFilter);
  }

  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  
  if (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true, data, count, page, pageSize });
}

const optionSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  content: z.string().min(1, 'Option text cannot be empty'),
  is_correct: z.boolean()
});

const createQuestionSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  bank_id: z.string().uuid('Please select a question bank'),
  content: z.string().min(10, 'Question text must be at least 10 characters'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  subject: z.string().min(1, 'Subject is required'),
  topic: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  explanation: z.string().min(20, 'Explanation must be at least 20 characters — students depend on this'),
  options: z.array(optionSchema)
    .min(2, 'A question must have at least 2 options')
    .max(6, 'A question can have at most 6 options')
    .refine(
      (opts) => opts.filter(o => o.is_correct).length === 1,
      'Exactly one option must be marked as the correct answer'
    )
});

export async function POST(request: Request) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: auth.error } }, { status: auth.status });

  const supabaseAdmin = auth.supabaseAdmin!;
  const adminUser = auth.user!;
  const body = await request.json();

  // Normalize text -> content for options & question body if legacy caller sends 'text'
  const normalizedBody = {
    ...body,
    content: body.content || body.text,
    options: Array.isArray(body.options)
      ? body.options.map((opt: any) => ({
          ...opt,
          content: opt.content || opt.text,
        }))
      : body.options,
  };

  const parsed = createQuestionSchema.safeParse(normalizedBody);
  
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

  const { id, bank_id, content, difficulty, subject, topic, tags, explanation, options } = parsed.data;

  if (id) {
    // UPDATE
    const { data: existing } = await supabaseAdmin.from('questions').select('id').eq('id', id).single();
    if (!existing) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Question not found' } }, { status: 404 });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('questions')
      .update({
        content,
        difficulty,
        subject,
        topic: topic || null,
        tags,
        explanation,
        updated_by: adminUser.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateErr) {
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: updateErr.message } }, { status: 500 });
    }

    // Replace options
    await supabaseAdmin.from('question_options').delete().eq('question_id', id);

    const optionsToInsert = options.map((opt, idx) => ({
      question_id: id,
      content: opt.content,
      is_correct: opt.is_correct,
      display_order: idx
    }));

    const { error: optErr } = await supabaseAdmin.from('question_options').insert(optionsToInsert);

    if (optErr) {
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update options: ' + optErr.message } }, { status: 500 });
    }

    // Audit Log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: adminUser.id,
      actor_role: 'admin',
      action: 'admin.question_edited',
      resource_type: 'question',
      resource_id: id,
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1'
    });

    return NextResponse.json({ success: true, message: 'Question updated successfully', id });
  } else {
    // CREATE
    const { data: newQ, error: createErr } = await supabaseAdmin
      .from('questions')
      .insert({
        bank_id,
        content,
        type: 'mcq',
        difficulty,
        subject,
        topic: topic || null,
        tags,
        explanation,
        created_by: adminUser.id,
        updated_by: adminUser.id
      })
      .select('id')
      .single();

    if (createErr || !newQ) {
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: createErr?.message || 'Failed to create question' } }, { status: 500 });
    }

    const optionsToInsert = options.map((opt, idx) => ({
      question_id: newQ.id,
      content: opt.content,
      is_correct: opt.is_correct,
      display_order: idx
    }));

    const { error: optErr } = await supabaseAdmin.from('question_options').insert(optionsToInsert);

    if (optErr) {
      await supabaseAdmin.from('questions').delete().eq('id', newQ.id);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to save options: ' + optErr.message } }, { status: 500 });
    }

    // Audit Log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: adminUser.id,
      actor_role: 'admin',
      action: 'admin.question_created',
      resource_type: 'question',
      resource_id: newQ.id,
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1'
    });

    return NextResponse.json({ success: true, message: 'Question created successfully', id: newQ.id }, { status: 201 });
  }
}

export async function PUT(request: Request) {
  return POST(request);
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: auth.error } }, { status: auth.status });

  const supabaseAdmin = auth.supabaseAdmin!;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'ID is required' } }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from('questions').select('id').eq('id', id).single();
  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Question not found' } }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from('questions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });

  return NextResponse.json({ success: true, message: 'Question archived' });
}
