import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { HeartbeatProvider } from '@/components/ui/HeartbeatProvider';
import { OfflineBanner } from '@/components/ui/OfflineBanner';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
  
  if (!user) {
    redirect('/login');
  }

  // Safely read user role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
    redirect('/dashboard');
  }

  // Fetch admin profile for name
  let adminName = 'Admin';
  if (userData.role === 'admin' || userData.role === 'super_admin') {
    const { data: adminProfile } = await supabase
      .from('admin_profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();
    if (adminProfile) adminName = adminProfile.full_name;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <OfflineBanner />
      <HeartbeatProvider />
      <AdminSidebar adminName={adminName} />
      <main className="flex-1 overflow-y-auto relative">
        {children}
      </main>
    </div>
  );
}
