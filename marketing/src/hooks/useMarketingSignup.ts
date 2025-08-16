import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { marketingApi, MarketingSignupResponse } from '../services/api';
import { MarketingSignupRequest } from '@shared/schemas/api';
import { getStoredUTMParameters, determineTrafficSource } from '../utils/utm';

interface UseMarketingSignupOptions {
  onSuccess?: (data: MarketingSignupResponse) => void;
  onError?: (error: Error) => void;
}

export function useMarketingSignup(options: UseMarketingSignupOptions = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data: Omit<MarketingSignupRequest, 'source' | 'utmParameters'> & { captchaToken?: string }) => {
      setIsSubmitting(true);
      
      // Enhance data with tracking information
      const utmParams = getStoredUTMParameters();
      // Filter out undefined values to match schema requirement
      const cleanUtmParams: Record<string, string> = {};
      Object.entries(utmParams).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanUtmParams[key] = value;
        }
      });

      const enhancedData: MarketingSignupRequest = {
        ...data,
        source: determineTrafficSource(),
        utmParameters: cleanUtmParams,
        captchaToken: data.captchaToken,
      };

      return marketingApi.submitSignup(enhancedData);
    },
    onSuccess: (data) => {
      setIsSubmitting(false);
      options.onSuccess?.(data);
    },
    onError: (error: Error) => {
      setIsSubmitting(false);
      options.onError?.(error);
    },
  });

  return {
    submitSignup: mutation.mutate,
    isSubmitting: isSubmitting || mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}