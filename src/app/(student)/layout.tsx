import React from 'react';
import { DeviceDetector } from '@/components/ui/DeviceDetector';
import { StudentNav } from '@/components/ui/StudentNav';
import { HeartbeatProvider } from '@/components/ui/HeartbeatProvider';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  
  let fullName = user?.user_metadata?.full_name || user?.email || 'Student';

  if (user && !user.user_metadata?.full_name) {
     const { data } = await supabase.from('student_profiles').select('full_name').eq('user_id', user.id).single();
     if (data?.full_name) fullName = data.full_name;
  }

  return (
    <>
      <OfflineBanner />
      <HeartbeatProvider />
      <DeviceDetector />
      <div className="min-h-screen bg-background">
        <StudentNav studentName={fullName} />
        <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </>
  );
}
