import React from 'react';
import { DeviceDetector } from '@/components/ui/DeviceDetector';
import { StudentNav } from '@/components/ui/StudentNav';
import { HeartbeatProvider } from '@/components/ui/HeartbeatProvider';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const reqHeaders = await headers();
  const requestId = reqHeaders.get('x-request-id') || 'unknown';
  const isRsc = reqHeaders.get('rsc') === '1' || (reqHeaders.get('accept') || '').includes('text/x-component');

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
  
  let fullName = user?.user_metadata?.full_name || user?.email || 'PROFILE_RESOLUTION_FAILED';

  if (user && !user.user_metadata?.full_name) {
     const { data } = await supabase.from('student_profiles').select('full_name').eq('user_id', user.id).maybeSingle();
     if (data?.full_name) {
       fullName = data.full_name;
     } else {
       console.error(`[CRITICAL_IDENTITY_TRACE]\nRequest ID: ${requestId}\nLayer: layout\nOrigin: server_component_layout\nPath: /dashboard\nMethod: GET\nIs RSC: ${isRsc}\nSource: student_profiles query\nUser ID: ${user.id}\nEmail: ${user.email || 'N/A'}\nError: PROFILE_RESOLUTION_FAILED\nTimestamp: ${new Date().toISOString()}`);
     }
  }

  if (process.env.ENABLE_PROFILING === 'true') {
    console.log(`[IDENTITY_TRACE]\nRequest ID: ${requestId}\nLayer: layout\nOrigin: server_component_layout\nPath: /dashboard\nMethod: GET\nIs RSC: ${isRsc}\nSource: student_profiles / auth.getUser()\nUser ID: ${user?.id || 'none'}\nEmail: ${user?.email || 'N/A'}\nFull Name: ${fullName}\nTimestamp: ${new Date().toISOString()}`);
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
