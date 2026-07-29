import { SupabaseClient } from '@supabase/supabase-js';

export async function syncExamStatuses(supabaseAdmin: SupabaseClient) {
  try {
    const nowIso = new Date().toISOString();

    // 1. Transition 'scheduled' exams whose start time has arrived to 'active'
    await supabaseAdmin
      .from('exams')
      .update({ status: 'active', updated_at: nowIso })
      .eq('type', 'scheduled')
      .eq('status', 'scheduled')
      .is('deleted_at', null)
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', nowIso)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

    // 2. Transition 'scheduled' or 'active' exams whose end time has passed to 'completed'
    await supabaseAdmin
      .from('exams')
      .update({ status: 'completed', updated_at: nowIso })
      .eq('type', 'scheduled')
      .in('status', ['scheduled', 'active'])
      .is('deleted_at', null)
      .not('ends_at', 'is', null)
      .lte('ends_at', nowIso);
  } catch (err) {
    console.error('[syncExamStatuses Error]', err);
  }
}
