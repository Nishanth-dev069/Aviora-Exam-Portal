'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, Folder, HelpCircle, FileText, Activity, BarChart2, LogOut, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createBrowserClient } from '@supabase/ssr';

interface Props {
  adminName: string;
}

export default function AdminSidebar({ adminName }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const navItems = [
    { name: 'Students', href: '/admin/students', icon: Users },
    { name: 'Batches', href: '/admin/batches', icon: Folder },
    { name: 'Questions', href: '/admin/question-banks', icon: HelpCircle },
    { name: 'Exams', href: '/admin/exams', icon: FileText },
    { name: 'Monitor', href: '/admin/monitoring', icon: Activity },
    { name: 'Reports', href: '/admin/reports', icon: BarChart2 },
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout API call error', err);
    }
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="w-16 md:w-60 h-full bg-surface border-r border-border flex flex-col transition-all duration-300 z-30 flex-shrink-0">
      
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-black flex-shrink-0">
            A
          </div>
          <span className="font-bold text-text-primary hidden md:inline">AVIORA Admin</span>
        </div>
      </div>

      {/* Admin Name Bar */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between hidden md:flex">
        <span className="text-sm font-medium text-text-secondary truncate pr-2">{adminName}</span>
        <ArrowUpRight className="w-4 h-4 text-text-muted flex-shrink-0" />
      </div>

      {/* Nav Links */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 custom-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              prefetch={true}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative',
                isActive 
                  ? 'bg-primary-light/30 text-primary' 
                  : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
              )}
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-primary' : 'text-text-muted group-hover:text-text-secondary')} />
              <span className="text-sm font-medium hidden md:block">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-text-secondary hover:bg-surface-2 hover:text-danger transition-colors group"
        >
          <LogOut className="w-5 h-5 flex-shrink-0 text-text-muted group-hover:text-danger" />
          <span className="text-sm font-medium hidden md:block">Logout</span>
        </button>
      </div>

    </aside>
  );
}
