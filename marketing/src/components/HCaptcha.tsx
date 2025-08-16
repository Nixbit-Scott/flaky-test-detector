import React, { useRef, useEffect, useState } from 'react';

declare global {
  interface Window {
    hcaptcha: any;
  }
}

interface HCaptchaProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  size?: 'normal' | 'compact';
  theme?: 'light' | 'dark';
  className?: string;
}

interface HCaptchaRef {
  reset: () => void;
}

const HCaptcha = React.forwardRef<HCaptchaRef, HCaptchaProps>(({
  siteKey,
  onVerify,
  onError,
  onExpire,
  size = 'normal',
  theme = 'light',
  className = '',
}, ref) => {
  const hcaptchaRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check if hCaptcha script is already loaded
    if (window.hcaptcha) {
      setIsLoaded(true);
      return;
    }

    // Load hCaptcha script
    const script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Cleanup script if component unmounts
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !window.hcaptcha || !hcaptchaRef.current) {
      return;
    }

    // Prevent multiple renders
    if (widgetId !== null) {
      console.log('hCaptcha already rendered with widget ID:', widgetId);
      return;
    }

    try {
      console.log('Rendering hCaptcha with site key:', siteKey);
      // Render hCaptcha widget
      const id = window.hcaptcha.render(hcaptchaRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          console.log('hCaptcha verified successfully');
          onVerify(token);
        },
        'error-callback': () => {
          console.error('hCaptcha error callback triggered');
          onError?.();
        },
        'expired-callback': () => {
          console.log('hCaptcha expired');
          onExpire?.();
        },
        size,
        theme,
      });

      console.log('hCaptcha rendered with widget ID:', id);
      setWidgetId(id);
    } catch (error) {
      console.error('Failed to render hCaptcha:', error);
    }
  }, [isLoaded, siteKey]); // Remove callback dependencies to prevent re-renders

  // Reset the captcha
  const reset = () => {
    if (window.hcaptcha && widgetId) {
      window.hcaptcha.reset(widgetId);
    }
  };

  // Expose reset method via useImperativeHandle with proper typing
  React.useImperativeHandle(ref, () => ({
    reset,
  }), [reset]);

  return (
    <div className={className}>
      <div ref={hcaptchaRef} />
    </div>
  );
});

export default HCaptcha;