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
    if (!isLoaded || !window.hcaptcha || !hcaptchaRef.current || widgetId) {
      return;
    }

    // Render hCaptcha widget
    const id = window.hcaptcha.render(hcaptchaRef.current, {
      sitekey: siteKey,
      callback: (token: string) => {
        onVerify(token);
      },
      'error-callback': () => {
        onError?.();
      },
      'expired-callback': () => {
        onExpire?.();
      },
      size,
      theme,
    });

    setWidgetId(id);
  }, [isLoaded, siteKey, onVerify, onError, onExpire, size, theme]);

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