/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import ProfileCard from '@/components/student/ProfileCard';
import SecurityCard from '@/components/student/SecurityCard';
import { redirect } from 'next/navigation';
import StudentAnalytics from '@/components/student/StudentAnalytics';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    redirect('/login');
  }

  // Fetch profile and batch
  const { data: profile } = await supabase
    .from('student_profiles')
    .select(`
      full_name,
      roll_number,
      phone,
      batch_id,
      batches (
        id,
        name
      )
    `)
    .eq('user_id', user.id)
    .maybeSingle();

  const batchesData: any = profile?.batches;
  const batchName = (Array.isArray(batchesData) ? batchesData[0]?.name : batchesData?.name) || 'Unassigned';

  const studentData = {
    fullName: profile?.full_name || 'Student',
    rollNumber: profile?.roll_number || 'Unassigned',
    email: user.email || '',
    batchName
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="mb-2">
        <h1 className="text-3xl font-black text-text-primary tracking-tight">My Profile</h1>
        <p className="text-text-secondary mt-1 text-sm font-medium">Manage your personal info, view performance analytics, and update security credentials.</p>
      </div>

      {/* 1. Student Personal Information Header */}
      <ProfileCard student={studentData} />

      {/* 2. Performance Analytics */}
      <StudentAnalytics />

      {/* 3. Security & Password Section (Entire Bottom) */}
      <SecurityCard />
    </div>
  );
}
