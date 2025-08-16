import axios from 'axios';
import { MarketingSignupRequest } from '@shared/schemas/api';

// Determine the correct API base URL based on environment
const getApiBaseUrl = () => {
  // If VITE_API_URL is explicitly set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In production (Netlify), use Netlify functions
  if (import.meta.env.PROD || window.location.hostname.includes('netlify') || window.location.hostname === 'nixbit.dev') {
    return '/.netlify/functions';
  }
  
  // In development, use local API
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

console.log('[API] Using API base URL:', API_BASE_URL);
console.log('[API] Environment:', {
  PROD: import.meta.env.PROD,
  hostname: window.location.hostname,
  VITE_API_URL: import.meta.env.VITE_API_URL
});

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add additional headers if needed
api.interceptors.request.use(
  (config) => {
    // Add any additional headers here
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url,
      });
    } else if (error.request) {
      // Request was made but no response
      console.error('Network Error:', error.request);
    } else {
      // Something else happened
      console.error('Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface MarketingSignupResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    email: string;
    createdAt: string;
  };
  errors?: any[];
}

// Marketing API functions
export const marketingApi = {
  async submitSignup(data: MarketingSignupRequest): Promise<MarketingSignupResponse> {
    try {
      const response = await api.post('/marketing-signup', data);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  async unsubscribe(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post('/marketing/unsubscribe', { email });
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },
};

export default api;