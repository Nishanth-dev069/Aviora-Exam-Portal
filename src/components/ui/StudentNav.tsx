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
    <header className="bg-surface border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          
          {/* Logo & Links */}
          <div className="flex">
            <Link href="/dashboard" className="flex flex-shrink-0 items-center gap-2.5 mr-8 hover:opacity-90 transition-opacity">
              <img src="/aviora-logo.png" alt="AVIORA Logo" className="h-8 w-auto object-contain" />
              <span className="text-lg font-black tracking-tight text-text-primary">
                AVIORA <span className="text-text-muted font-normal text-xs ml-0.5">Portal</span>
              </span>
            </Link>
            
            <nav className="hidden md:flex space-x-8">
              {navLinks.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                      isActive 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
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
              <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-2 border border-border shrink-0 flex items-center justify-center shadow-xs">
                {photoUrl ? (
                  <img src={photoUrl} alt={studentName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xs">
                    {initial}
                  </div>
                )}
              </div>
              <span className="hidden sm:block text-sm font-bold text-text-primary">
                {studentName}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-text-secondary hover:text-danger hover:bg-danger/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>

        </div>
      </div>
    </header>
  );
}
