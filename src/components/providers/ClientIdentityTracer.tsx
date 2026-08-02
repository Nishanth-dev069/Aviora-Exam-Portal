'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function ClientIdentityTracer() {
  const router = useRouter();
  const prevIdentity = useRef<{ userId: string | null; email: string | null }>({ userId: null, email: null });

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      const currentUserId = currentUser?.id ?? 'none';
      const currentEmail = currentUser?.email ?? 'N/A';
      const prevUserId = prevIdentity.current.userId;

      let refreshed = false;
      let reason = '';

      if (prevUserId === null) {
        reason = 'Skipped: Initial session mount (no previous identity recorded)';
      } else if (prevUserId === currentUserId) {
        reason = `Skipped: User ID unchanged (${currentUserId})`;
      } else {
        refreshed = true;
        reason = `INVOKED router.refresh(): User ID changed from ${prevUserId} -> ${currentUserId}`;
        router.refresh();
      }

      console.log(
        `[CLIENT_AUTH_SYNC_TRACE]\nEvent: ${event}\nPrevious User ID: ${prevUserId ?? 'null'}\nCurrent User ID: ${currentUserId}\nEmail: ${currentEmail}\nRouter Refreshed: ${refreshed}\nReason: ${reason}\nTimestamp: ${new Date().toISOString()}`
      );

      prevIdentity.current = { userId: currentUserId, email: currentEmail };
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
