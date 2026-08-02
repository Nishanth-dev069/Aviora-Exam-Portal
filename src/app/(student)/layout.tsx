import React from 'react';
import { DeviceDetector } from '@/components/ui/DeviceDetector';
import { StudentNav } from '@/components/ui/StudentNav';
import { HeartbeatProvider } from '@/components/ui/HeartbeatProvider';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

import { getSignedUrl } from '@/lib/storage/signed-urls';

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
  let photoUrl: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('full_name, photo_url')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.full_name) {
      fullName = profile.full_name;
    }
    if (profile?.photo_url) {
      photoUrl = await getSignedUrl(profile.photo_url, 3600);
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
      <div className="min-h-screen bg-background flex flex-col">
        <StudentNav studentName={fullName} photoUrl={photoUrl} />
        <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex-1 w-full">
          {children}
        </main>
        <footer className="border-t border-border py-4 bg-surface text-center mt-auto">
          <div className="flex items-center justify-center gap-1.5 text-xs text-text-muted">
            <span>Developed & maintained by</span>
            <a
              href="https://zyxen.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-primary hover:underline ml-0.5"
            >
              <img src="/zyxen-logo.jpeg" alt="ZYXEN Logo" className="h-4 w-auto rounded-xs object-contain" />
              <span>ZYXEN</span>
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}
