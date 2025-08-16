import { useState, useCallback, useRef } from 'react';

interface UseCaptchaOptions {
  onError?: (error: string) => void;
}

export const useCaptcha = (options: UseCaptchaOptions = {}) => {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const errorCountRef = useRef(0);

  const handleCaptchaVerify = useCallback((token: string) => {
    console.log('[useCaptcha] Turnstile verification successful');
    setCaptchaToken(token);
    setIsCaptchaVerified(true);
    setCaptchaError(null);
    errorCountRef.current = 0; // Reset error count on successful verification
  }, []);

  const handleCaptchaError = useCallback(() => {
    console.error('[useCaptcha] Turnstile verification error');
    errorCountRef.current += 1;
    
    let errorMessage = 'Verification failed. Please try again.';
    
    // Simpler error handling for Turnstile (it's more reliable than hCaptcha)
    if (errorCountRef.current >= 3) {
      errorMessage = 'Multiple verification failures. Please refresh the page and try again.';
    }
    
    setCaptchaError(errorMessage);
    setCaptchaToken(null);
    setIsCaptchaVerified(false);
    options.onError?.(errorMessage);
  }, [options]);

  const handleCaptchaExpire = useCallback(() => {
    console.log('[useCaptcha] Turnstile token expired');
    const errorMessage = 'Verification expired. Please verify again.';
    setCaptchaError(errorMessage);
    setCaptchaToken(null);
    setIsCaptchaVerified(false);
    options.onError?.(errorMessage);
  }, [options]);

  const resetCaptcha = useCallback(() => {
    console.log('[useCaptcha] Resetting verification state');
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