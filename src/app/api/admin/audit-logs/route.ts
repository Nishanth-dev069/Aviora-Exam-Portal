import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify caller is super_admin
    const { data: caller } = await supabaseAdmin
      .from('users')
      .select('role, deleted_at')
      .eq('id', session.user.id)
      .single();

    if (!caller || caller.role !== 'super_admin' || caller.deleted_at) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Only Super Admins can access audit logs.' } }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';
    const actionFilter = searchParams.get('action') || '';
    const actorIdFilter = searchParams.get('actor_id') || '';
    const dateRange = searchParams.get('date_range') || ''; // 'today', '7d', '30d'

    // Build query for audit_logs
    let query = supabaseAdmin
      .from('audit_logs')
      .select('id, actor_id, actor_role, action, resource_type, resource_id, metadata, ip_address, created_at', { count: 'exact' });

    if (actorIdFilter) {
      query = query.eq('actor_id', actorIdFilter);
    }

    if (actionFilter) {
      if (actionFilter.endsWith('*')) {
        query = query.like('action', `${actionFilter.slice(0, -1)}%`);
      } else {
        query = query.eq('action', actionFilter);
      }
    }

    if (dateRange === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      query = query.gte('created_at', todayStart.toISOString());
    } else if (dateRange === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      query = query.gte('created_at', d.toISOString());
    } else if (dateRange === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      query = query.gte('created_at', d.toISOString());
    }

    if (search) {
      query = query.or(`action.ilike.%${search}%,resource_type.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: logs, count, error: fetchErr } = await query;

    if (fetchErr) {
      console.error('[Audit Logs API Error]', fetchErr);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: fetchErr.message } }, { status: 500 });
    }

    // Resolve actor emails for display
    const actorIds = Array.from(new Set((logs || []).map(l => l.actor_id).filter(Boolean)));
    const actorEmailMap: Record<string, string> = {};

    if (actorIds.length > 0) {
      const { data: usersData } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .in('id', actorIds);

      (usersData || []).forEach(u => {
        actorEmailMap[u.id] = u.email;
      });
    }

    const enrichedLogs = (logs || []).map(l => ({
      ...l,
      actor_email: actorEmailMap[l.actor_id] || 'Unknown User',
    }));

    return NextResponse.json({
      success: true,
      logs: enrichedLogs,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: unknown) {
    console.error('[Audit Logs API Exception]', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Internal error' } }, { status: 500 });
  }
}
