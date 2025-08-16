import { useState, useCallback, useRef } from 'react';

interface UseCaptchaOptions {
  onError?: (error: string) => void;
}

export const useCaptcha = (options: UseCaptchaOptions = {}) => {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const errorCountRef = useRef(0);
  const lastErrorTimeRef = useRef<number>(0);

  const handleCaptchaVerify = useCallback((token: string) => {
    console.log('[useCaptcha] Verification successful, resetting error count');
    setCaptchaToken(token);
    setIsCaptchaVerified(true);
    setCaptchaError(null);
    errorCountRef.current = 0; // Reset error count on successful verification
  }, []);

  const handleCaptchaError = useCallback(() => {
    console.error('[useCaptcha] CAPTCHA error occurred');
    errorCountRef.current += 1;
    lastErrorTimeRef.current = Date.now();
    
    let errorMessage = 'CAPTCHA verification failed. Please try again.';
    
    // Provide specific error messages based on error count
    if (errorCountRef.current >= 3) {
      errorMessage = 'Multiple verification failures detected. You may be rate limited. Please wait a moment before trying again.';
    } else if (errorCountRef.current >= 5) {
      errorMessage = 'Too many verification attempts. Please refresh the page and try again.';
    }
    
    setCaptchaError(errorMessage);
    setCaptchaToken(null);
    setIsCaptchaVerified(false);
    options.onError?.(errorMessage);
  }, [options]);

  const handleCaptchaExpire = useCallback(() => {
    console.log('[useCaptcha] CAPTCHA expired');
    const errorMessage = 'CAPTCHA expired. Please verify again.';
    setCaptchaError(errorMessage);
    setCaptchaToken(null);
    setIsCaptchaVerified(false);
    options.onError?.(errorMessage);
  }, [options]);

  const resetCaptcha = useCallback(() => {
    console.log('[useCaptcha] Resetting CAPTCHA state');
    setCaptchaToken(null);
    setIsCaptchaVerified(false);
    setCaptchaError(null);
    errorCountRef.current = 0; // Reset error count when manually resetting
  }, []);

  return {
    captchaToken,
    isCaptchaVerified,
    captchaError,
    handleCaptchaVerify,
    handleCaptchaError,
    handleCaptchaExpire,
    resetCaptcha,
  };
};