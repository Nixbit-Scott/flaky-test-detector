import { useState, useCallback } from 'react';

interface UseCaptchaOptions {
  onError?: (error: string) => void;
}

export const useCaptcha = (options: UseCaptchaOptions = {}) => {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  const handleCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token);
    setIsCaptchaVerified(true);
    setCaptchaError(null);
  }, []);

  const handleCaptchaError = useCallback(() => {
    const errorMessage = 'CAPTCHA verification failed. Please try again.';
    setCaptchaError(errorMessage);
    setCaptchaToken(null);
    setIsCaptchaVerified(false);
    options.onError?.(errorMessage);
  }, [options]);

  const handleCaptchaExpire = useCallback(() => {
    const errorMessage = 'CAPTCHA expired. Please verify again.';
    setCaptchaError(errorMessage);
    setCaptchaToken(null);
    setIsCaptchaVerified(false);
    options.onError?.(errorMessage);
  }, [options]);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null);
    setIsCaptchaVerified(false);
    setCaptchaError(null);
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