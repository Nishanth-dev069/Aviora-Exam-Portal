'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, Folder, HelpCircle, FileText, Activity, BarChart2, LogOut, ArrowUpRight, ShieldCheck, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createBrowserClient } from '@supabase/ssr';

interface Props {
  adminName: string;
  userRole?: string;
}

export default function AdminSidebar({ adminName, userRole }: Props) {
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

  if (userRole === 'super_admin') {
    navItems.push(
      { name: 'Admins', href: '/admin/admins', icon: ShieldCheck },
      { name: 'Audit Logs', href: '/admin/audit-logs', icon: ShieldAlert }
    );
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout API call error', err);
    }
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <aside className="w-16 md:w-60 h-full bg-surface border-r border-border flex flex-col transition-all duration-300 z-30 flex-shrink-0">
      
      {/* Header (Logo Cell Only) */}
      <div className="h-16 flex items-center justify-between px-4 bg-[#0F4383] border-b border-blue-900/60 shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden whitespace-nowrap">
          <img src="/aviora-logo-full.png" alt="AVIORA Logo" className="h-10 w-auto object-contain shrink-0 drop-shadow-xs" />
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

      {/* Footer / Logout & Zyxen Branding */}
      <div className="p-4 border-t border-border space-y-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-text-secondary hover:bg-surface-2 hover:text-danger transition-colors group"
        >
          <LogOut className="w-5 h-5 flex-shrink-0 text-text-muted group-hover:text-danger" />
          <span className="text-sm font-medium hidden md:block">Logout</span>
        </button>

        <div className="pt-2 border-t border-border/60 hidden md:block text-[11px] text-text-muted text-center leading-relaxed">
          <span>Developed & maintained by</span>
          <a
            href="https://zyxen.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1 font-bold text-primary hover:underline ml-1"
          >
            <img src="/zyxen-logo.jpeg" alt="ZYXEN Logo" className="h-3.5 w-auto rounded-xs object-contain" />
            <span>ZYXEN</span>
          </a>
        </div>
      </div>

    </aside>
  );
}
