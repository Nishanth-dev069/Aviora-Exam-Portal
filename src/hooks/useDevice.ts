import { useEffect, useState } from 'react';

export function useDevice() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      // Logic directly from PRD section 6.1
      const isPhone = (
        window.screen.width < 768 &&
        window.matchMedia('(pointer: coarse)').matches &&
        !window.matchMedia('(min-width: 768px)').matches
      );
      setIsMobile(isPhone);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    
    return () => {
      window.removeEventListener('resize', checkDevice);
    };
  }, []);

  return { isMobile };
}
