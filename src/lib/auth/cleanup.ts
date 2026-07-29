import { createBrowserClient } from '@supabase/ssr';

export async function clearAuthState(): Promise<void> {
  try {
    // 1. Sign out from Supabase
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
  } catch {
    // Best effort
  }

  try {
    // 2. Clear IndexedDB (Dexie)
    const { db } = await import('@/lib/db');
    await db.delete();
    await db.open();
  } catch {
    // Best effort
  }

  try {
    // 3. Clear session storage
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
  } catch {
    // Best effort
  }
}
