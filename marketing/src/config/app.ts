// App configuration for different environments

const getAppConfig = () => {
  // Check if we have a specific dashboard URL set
  const dashboardUrl = import.meta.env.VITE_DASHBOARD_URL;
  
  if (dashboardUrl) {
    // Use the configured dashboard URL
    return {
      dashboardUrl: dashboardUrl.startsWith('http') ? dashboardUrl : `${window.location.origin}${dashboardUrl}`,
      apiUrl: import.meta.env.VITE_API_URL || '/.netlify/functions',
    };
  }
  
  // In production, if no specific dashboard URL is set, redirect to the deployed dashboard
  if (import.meta.env.PROD) {
    return {
      dashboardUrl: 'https://flakytestdetector.netlify.app',
      apiUrl: import.meta.env.VITE_API_URL || '/.netlify/functions',
    };
  }
  
  // Development configuration
  return {
    dashboardUrl: 'http://localhost:5173',
    apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  };
};

export const appConfig = getAppConfig();

export default appConfig;