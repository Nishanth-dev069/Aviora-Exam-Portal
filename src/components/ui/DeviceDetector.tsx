'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDevice } from '@/hooks/useDevice';

export function DeviceDetector() {
  const { isMobile } = useDevice();
  const router = useRouter();

  useEffect(() => {
    if (isMobile) {
      router.replace('/device-blocked');
    }
  }, [isMobile, router]);

  return null;
}
