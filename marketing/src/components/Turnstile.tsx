import React, { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    turnstile: {
      render: (element: HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string;
    };
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
}

interface TurnstileProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  className?: string;
}

interface TurnstileRef {
  reset: () => void;
}

const Turnstile = React.forwardRef<TurnstileRef, TurnstileProps>(({
  siteKey,
  onVerify,
  onError,
  onExpire,
  theme = 'auto',
  size = 'normal',
  className = '',
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDestroyedRef = useRef(false);

  // Stable callback refs to prevent re-renders
  const stableOnVerify = useCallback((token: string) => {
    console.log('[Turnstile] Verification successful');
    setError(null);
    onVerify(token);
  }, [onVerify]);

  const stableOnError = useCallback(() => {
    console.error('[Turnstile] Verification failed');
    setError('Verification failed. Please try again.');
    onError?.();
  }, [onError]);

  const stableOnExpire = useCallback(() => {
    console.log('[Turnstile] Token expired');
    setError('Verification expired. Please try again.');
    onExpire?.();
  }, [onExpire]);

  // Load Turnstile script
  useEffect(() => {
    if (window.turnstile) {
      console.log('[Turnstile] Script already loaded');
      setIsLoaded(true);
      return;
    }

    console.log('[Turnstile] Loading Cloudflare Turnstile script...');
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('[Turnstile] Script loaded successfully');
      setIsLoaded(true);
    };
    
    script.onerror = () => {
      console.error('[Turnstile] Failed to load script');
      setError('Failed to load verification service. Please refresh the page.');
    };
    
    document.head.appendChild(script);

    return () => {
      console.log('[Turnstile] Cleaning up script');
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Render widget
  useEffect(() => {
    if (!isLoaded || !window.turnstile || !containerRef.current || isDestroyedRef.current) {
      return;
    }

    // Don't render if widget already exists
    if (widgetIdRef.current !== null) {
      console.log('[Turnstile] Widget already rendered');
      return;
    }

    try {
      console.log('[Turnstile] Rendering widget...');
      
      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: stableOnVerify,
        'error-callback': stableOnError,
        'expired-callback': stableOnExpire,
        theme,
        size,
      });

      console.log('[Turnstile] Widget rendered with ID:', widgetId);
      widgetIdRef.current = widgetId;
      setError(null);
    } catch (err) {
      console.error('[Turnstile] Failed to render widget:', err);
      setError('Failed to initialize verification. Please refresh the page.');
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          console.log('[Turnstile] Removing widget:', widgetIdRef.current);
          window.turnstile.remove(widgetIdRef.current);
        } catch (err) {
          console.warn('[Turnstile] Failed to remove widget:', err);
        }
        widgetIdRef.current = null;
      }
    };
  }, [isLoaded, siteKey, theme, size, stableOnVerify, stableOnError, stableOnExpire]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      console.log('[Turnstile] Component unmounting');
      isDestroyedRef.current = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (err) {
          console.warn('[Turnstile] Cleanup error:', err);
        }
        widgetIdRef.current = null;
      }
    };
  }, []);

  // Reset function
  const reset = useCallback(() => {
    if (window.turnstile && widgetIdRef.current) {
      try {
        console.log('[Turnstile] Resetting widget');
        window.turnstile.reset(widgetIdRef.current);
        setError(null);
      } catch (err) {
        console.error('[Turnstile] Failed to reset widget:', err);
      }
    }
  }, []);

  // Expose reset method
  React.useImperativeHandle(ref, () => ({
    reset,
  }), [reset]);

  return (
    <div className={className}>
      <div ref={containerRef} />
      {error && (
        <div className="text-red-600 text-sm mt-2 text-center">
          {error}
        </div>
      )}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 mt-1 text-center">
          Turnstile Widget ID: {widgetIdRef.current || 'none'}
        </div>
      )}
    </div>
  );
});

Turnstile.displayName = 'Turnstile';

export default Turnstile;