import React from 'react';
import { DeviceDetector } from '@/components/ui/DeviceDetector';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DeviceDetector />
      <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        {children}
      </div>
    </>
  );
}
