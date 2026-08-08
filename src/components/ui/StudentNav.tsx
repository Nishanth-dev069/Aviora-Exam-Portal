'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plane, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface StudentNavProps {
  studentName: string;
  photoUrl?: string | null;
}

import { clearAuthState } from '@/lib/auth/cleanup';

export function StudentNav({ studentName, photoUrl }: StudentNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    await clearAuthState();
    window.location.href = '/login';
  };

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Exams', href: '/exams' },
    { name: 'Results', href: '/results' },
    { name: 'Leaderboard', href: '/leaderboard' },
    { name: 'Profile', href: '/profile' },
  ];

  const initial = (studentName || 'S').charAt(0).toUpperCase();

  return (
    <header className="bg-[#0F4383] border-b border-blue-900/60 shadow-md w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          
          {/* Logo & Links */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex flex-shrink-0 items-center mr-8 hover:opacity-95 transition-opacity">
              <img src="/aviora-logo-full.png" alt="AVIORA Logo" className="h-10 w-auto object-contain shrink-0 drop-shadow-xs" />
            </Link>
            
            <nav className="hidden md:flex space-x-6">
              {navLinks.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`inline-flex items-center px-2 pt-1 border-b-2 text-sm font-semibold transition-all ${
                      isActive 
                        ? 'border-white text-white font-black' 
                        : 'border-transparent text-white/90 hover:text-white hover:brightness-125 hover:border-white/50'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-white/15 border border-white/30 shrink-0 flex items-center justify-center shadow-xs">
                {photoUrl ? (
                  <img src={photoUrl} alt={studentName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/20 text-white font-bold text-xs">
                    {initial}
                  </div>
                )}
              </div>
              <span className="hidden sm:block text-sm font-bold text-white">
                {studentName}
              </span>
            </div>
            <button 
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs sm:text-sm font-bold shadow-sm shadow-red-950/25 transition-all cursor-pointer border border-red-500/40 hover:border-red-600"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Logout
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
