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
    mutationFn: async (data: Omit<MarketingSignupRequest, 'source' | 'utmParameters'>) => {
      setIsSubmitting(true);
      
      // Enhance data with tracking information
      const enhancedData: MarketingSignupRequest = {
        ...data,
        source: determineTrafficSource(),
        utmParameters: getStoredUTMParameters(),
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