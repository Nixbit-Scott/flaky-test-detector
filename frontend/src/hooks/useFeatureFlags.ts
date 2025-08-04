import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { FeatureFlagService, FeatureFlag, FeatureFlagConfig } from '../../../shared/src/services/feature-flags';
import { useAuth } from '../contexts/AuthContext';

interface FeatureFlagContextType {
  featureFlags: FeatureFlagService | null;
  isEnabled: (flagKey: string) => boolean;
  getFlag: (flagKey: string) => FeatureFlag | undefined;
  loading: boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextType>({
  featureFlags: null,
  isEnabled: () => false,
  getFlag: () => undefined,
  loading: true,
});

interface FeatureFlagProviderProps {
  children: ReactNode;
}

export const FeatureFlagProvider: React.FC<FeatureFlagProviderProps> = ({ children }) => {
  const { user, organization } = useAuth();
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagService | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeFeatureFlags = async () => {
      try {
        // Get environment from Vite environment variables
        const environment = (import.meta.env.VITE_ENVIRONMENT as 'development' | 'beta' | 'production') || 'production';
        
        // Fetch feature flags from API or use static config for beta
        let flags: FeatureFlag[] = [];
        
        if (environment === 'beta') {
          flags = FeatureFlagService.getBetaFlags();
        } else {
          // In production, fetch from API
          try {
            const response = await fetch('/.netlify/functions/feature-flags', {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              flags = data.flags || [];
            }
          } catch (error) {
            console.warn('Failed to fetch feature flags from API, using defaults:', error);
            flags = [];
          }
        }

        const config: FeatureFlagConfig = {
          flags,
          userId: user?.id,
          organizationId: organization?.id,
          environment,
          version: '1.0.0', // Should come from package.json or build info
          userProperties: {
            plan: user?.plan || 'free',
            role: user?.role || 'user',
            signupDate: user?.createdAt,
          },
        };

        const flagService = new FeatureFlagService(config);
        setFeatureFlags(flagService);
      } catch (error) {
        console.error('Failed to initialize feature flags:', error);
        // Create empty service as fallback
        const fallbackConfig: FeatureFlagConfig = {
          flags: [],
          environment: 'production',
        };
        setFeatureFlags(new FeatureFlagService(fallbackConfig));
      } finally {
        setLoading(false);
      }
    };

    initializeFeatureFlags();
  }, [user, organization]);

  const isEnabled = (flagKey: string): boolean => {
    return featureFlags?.isEnabled(flagKey) || false;
  };

  const getFlag = (flagKey: string): FeatureFlag | undefined => {
    return featureFlags?.getFlag(flagKey);
  };

  return (
    <FeatureFlagContext.Provider value={{ featureFlags, isEnabled, getFlag, loading }}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

export const useFeatureFlags = (): FeatureFlagContextType => {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
};

// Convenience hook for checking a single feature flag
export const useFeatureFlag = (flagKey: string): boolean => {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(flagKey);
};