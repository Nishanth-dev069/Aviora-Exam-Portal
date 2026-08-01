'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export function ClientIdentityTracer() {
  const prevIdentity = useRef<{ userId: string | null; email: string | null }>({ userId: null, email: null });

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_PROFILING !== 'true') return;

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      const currentUserId = currentUser?.id ?? 'none';
      const currentEmail = currentUser?.email ?? 'N/A';

      console.log(
        `[CLIENT_AUTH_STATE_CHANGE]\nEvent: ${event}\nUser ID: ${currentUserId}\nEmail: ${currentEmail}\nTimestamp: ${new Date().toISOString()}`
      );

      if (prevIdentity.current.userId && prevIdentity.current.userId !== currentUserId) {
        console.error(
          `[CRITICAL_CLIENT_IDENTITY_TRANSITION]\nEvent: ${event}\nPrevious User ID: ${prevIdentity.current.userId}\nPrevious Email: ${prevIdentity.current.email}\nCurrent User ID: ${currentUserId}\nCurrent Email: ${currentEmail}\nTimestamp: ${new Date().toISOString()}`
        );
      }

      prevIdentity.current = { userId: currentUserId, email: currentEmail };
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
