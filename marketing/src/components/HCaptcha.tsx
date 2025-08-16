import React, { useRef, useEffect, useState, useCallback } from 'react';

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
  const widgetIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const lastErrorTimeRef = useRef<number>(0);
  const isDestroyedRef = useRef(false);
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);

  // Update refs when props change
  useEffect(() => {
    onVerifyRef.current = onVerify;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;
  });

  // Stable callback refs to prevent re-renders
  const stableOnVerify = useCallback((token: string) => {
    console.log('[hCaptcha] Verification successful, token received');
    retryCountRef.current = 0;
    setRenderError(null);
    onVerifyRef.current(token);
  }, []);

  const stableOnError = useCallback(() => {
    console.error('[hCaptcha] Error callback triggered');
    retryCountRef.current += 1;
    lastErrorTimeRef.current = Date.now();
    
    // Implement exponential backoff for rate limiting
    if (retryCountRef.current >= 3) {
      setRenderError('Too many verification attempts. Please wait before trying again.');
    }
    
    onErrorRef.current?.();
  }, []);

  const stableOnExpire = useCallback(() => {
    console.log('[hCaptcha] Token expired');
    onExpireRef.current?.();
  }, []);

  // Script loading effect
  useEffect(() => {
    // Check if hCaptcha script is already loaded
    if (window.hcaptcha) {
      console.log('[hCaptcha] Script already loaded');
      setIsLoaded(true);
      return;
    }

    console.log('[hCaptcha] Loading script...');
    // Load hCaptcha script
    const script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('[hCaptcha] Script loaded successfully');
      setIsLoaded(true);
    };
    script.onerror = () => {
      console.error('[hCaptcha] Failed to load script');
      setRenderError('Failed to load verification service');
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup script if component unmounts
      console.log('[hCaptcha] Cleaning up script');
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Widget rendering effect
  useEffect(() => {
    if (!isLoaded || !window.hcaptcha || !hcaptchaRef.current || isDestroyedRef.current) {
      return;
    }

    // Prevent multiple renders - check if widget already exists
    if (widgetIdRef.current !== null) {
      console.log('[hCaptcha] Widget already rendered with ID:', widgetIdRef.current);
      return;
    }

    // Rate limiting check - implement circuit breaker
    const timeSinceLastError = Date.now() - lastErrorTimeRef.current;
    const backoffTime = Math.pow(2, retryCountRef.current) * 1000; // Exponential backoff
    
    if (retryCountRef.current >= 3 && timeSinceLastError < backoffTime) {
      console.log('[hCaptcha] Rate limited, waiting for backoff period');
      setRenderError(`Please wait ${Math.ceil((backoffTime - timeSinceLastError) / 1000)} seconds before trying again.`);
      return;
    }

    try {
      console.log('[hCaptcha] Rendering widget with site key:', siteKey);
      
      // Ensure the container is empty
      if (hcaptchaRef.current.hasChildNodes()) {
        console.log('[hCaptcha] Clearing existing widget content');
        hcaptchaRef.current.innerHTML = '';
      }
      
      // Render hCaptcha widget
      const id = window.hcaptcha.render(hcaptchaRef.current, {
        sitekey: siteKey,
        callback: stableOnVerify,
        'error-callback': stableOnError,
        'expired-callback': stableOnExpire,
        size,
        theme,
      });

      console.log('[hCaptcha] Widget rendered successfully with ID:', id);
      widgetIdRef.current = id;
      setRenderError(null);
    } catch (error) {
      console.error('[hCaptcha] Failed to render widget:', error);
      setRenderError('Failed to initialize verification. Please refresh the page.');
      retryCountRef.current += 1;
      lastErrorTimeRef.current = Date.now();
    }

    // Cleanup function to destroy widget when effect reruns or component unmounts
    return () => {
      if (widgetIdRef.current !== null && window.hcaptcha) {
        try {
          console.log('[hCaptcha] Destroying widget:', widgetIdRef.current);
          window.hcaptcha.remove(widgetIdRef.current);
        } catch (error) {
          console.warn('[hCaptcha] Failed to destroy widget:', error);
        }
        widgetIdRef.current = null;
      }
    };
  }, [isLoaded, siteKey, size, theme]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      console.log('[hCaptcha] Component unmounting, marking as destroyed');
      isDestroyedRef.current = true;
      if (widgetIdRef.current !== null && window.hcaptcha) {
        try {
          console.log('[hCaptcha] Final cleanup of widget:', widgetIdRef.current);
          window.hcaptcha.remove(widgetIdRef.current);
        } catch (error) {
          console.warn('[hCaptcha] Failed to cleanup widget on unmount:', error);
        }
        widgetIdRef.current = null;
      }
    };
  }, []);

  // Reset the captcha
  const reset = useCallback(() => {
    if (window.hcaptcha && widgetIdRef.current) {
      try {
        console.log('[hCaptcha] Resetting widget:', widgetIdRef.current);
        window.hcaptcha.reset(widgetIdRef.current);
        setRenderError(null);
        retryCountRef.current = 0;
      } catch (error) {
        console.error('[hCaptcha] Failed to reset widget:', error);
      }
    }
  }, []);

  // Expose reset method via useImperativeHandle with proper typing
  React.useImperativeHandle(ref, () => ({
    reset,
  }), [reset]);

  return (
    <div className={className}>
      <div ref={hcaptchaRef} />
      {renderError && (
        <div className="text-red-600 text-sm mt-2 text-center">
          {renderError}
        </div>
      )}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 mt-1 text-center">
          Widget ID: {widgetIdRef.current || 'none'} | Retries: {retryCountRef.current}
        </div>
      )}
    </div>
  );
});

export default HCaptcha;