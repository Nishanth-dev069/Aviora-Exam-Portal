export const dynamic = 'force-dynamic';
export const revalidate = 0;

import ExamStatusBoard from '@/components/admin/ExamStatusBoard';
import { supabaseAdmin } from '@/lib/supabase/admin';

export default async function MonitoringPage() {
  // Fetch all non-deleted exams for live monitoring
  const { data: exams } = await supabaseAdmin
    .from('exams')
    .select('id, title, type, status, settings')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">Live Monitoring</h1>
        <p className="text-text-secondary mt-2">Track real-time session statuses and security events across active and scheduled exams.</p>
      </div>
      
      <ExamStatusBoard activeExams={exams || []} />
    </div>
  );
}
