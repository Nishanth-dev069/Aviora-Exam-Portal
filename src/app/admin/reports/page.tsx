import PostExamReport from '@/components/admin/PostExamReport';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { syncExamStatuses } from '@/lib/supabase/syncStatuses';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReportsPage() {
  await syncExamStatuses(supabaseAdmin);

  // Fetch all non-deleted exams for reports
  const { data: exams } = await supabaseAdmin
    .from('exams')
    .select('id, title, type, status')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">Post-Exam Reports</h1>
        <p className="text-text-secondary mt-2">Analyze class performance, student leaderboards, and question difficulty metrics.</p>
      </div>
      
      <PostExamReport exams={exams || []} />
    </div>
  );
}
