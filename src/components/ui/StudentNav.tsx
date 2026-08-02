'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plane, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface StudentNavProps {
  studentName: string;
}

import { clearAuthState } from '@/lib/auth/cleanup';

export function StudentNav({ studentName }: StudentNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      await clearAuthState();
      window.location.href = '/login';
    } catch {
      await clearAuthState();
      window.location.href = '/login';
    }
  };

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Exams', href: '/exams' },
    { name: 'Results', href: '/results' },
    { name: 'Leaderboard', href: '/leaderboard' },
    { name: 'Profile', href: '/profile' },
  ];

  return (
    <header className="bg-surface border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          
          {/* Logo & Links */}
          <div className="flex">
            <div className="flex flex-shrink-0 items-center text-primary font-bold gap-2 mr-8">
              <Plane className="h-5 w-5" />
              <span>AVIORA Portal</span>
            </div>
            
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
            <span className="hidden sm:block text-sm font-medium text-text-primary">
              {studentName}
            </span>
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
