import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import jwtDecode from 'jwt-decode';
import { AuthState, AdminUser } from '../types';
import { authService } from '../services/authService';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: AdminUser; token: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH_START' }
  | { type: 'REFRESH_SUCCESS'; payload: AdminUser }
  | { type: 'REFRESH_FAILURE' };

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('admin_token'),
  isLoading: false,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
    case 'REFRESH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isLoading: false,
        user: action.payload.user,
        token: action.payload.token,
        error: null,
      };
    case 'REFRESH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        user: action.payload,
        error: null,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        isLoading: false,
        user: null,
        token: null,
        error: action.payload,
      };
    case 'REFRESH_FAILURE':
    case 'LOGOUT':
      return {
        ...state,
        isLoading: false,
        user: null,
        token: null,
        error: null,
      };
    default:
      return state;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state from token
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      try {
        // Verify token is not expired
        const decoded = jwtDecode(token);
        if (decoded.exp && decoded.exp * 1000 > Date.now()) {
          refreshAuth();
        } else {
          // Token expired, remove it
          localStorage.removeItem('admin_token');
          dispatch({ type: 'LOGOUT' });
        }
      } catch (error) {
        // Invalid token, remove it
        localStorage.removeItem('admin_token');
        dispatch({ type: 'LOGOUT' });
      }
    }
  }, []);

  // Update localStorage when token changes
  useEffect(() => {
    if (state.token) {
      localStorage.setItem('admin_token', state.token);
    } else {
      localStorage.removeItem('admin_token');
    }
  }, [state.token]);

  const login = async (email: string, password: string): Promise<void> => {
    console.log('AuthContext: Starting admin login process');
    dispatch({ type: 'LOGIN_START' });
    
    try {
      console.log('AuthContext: Calling authService.login');
      const response = await authService.login(email, password);
      console.log('AuthContext: Login response received', { user: response.user });
      
      // Verify user is system admin
      if (!response.user.isSystemAdmin) {
        throw new Error('Access denied. System admin privileges required.');
      }
      
      console.log('AuthContext: Admin verification passed, dispatching success');
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: response.user,
          token: response.token,
        },
      });
      console.log('AuthContext: Login success dispatched');
    } catch (error) {
      console.error('AuthContext: Login failed', error);
      const message = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: message });
      throw error;
    }
  };

  const logout = (): void => {
    dispatch({ type: 'LOGOUT' });
  };

  const refreshAuth = async (): Promise<void> => {
    if (!state.token) return;
    
    dispatch({ type: 'REFRESH_START' });
    
    try {
      const user = await authService.getCurrentUser();
      
      // Verify user is still system admin
      if (!user.isSystemAdmin) {
        dispatch({ type: 'LOGOUT' });
        throw new Error('Admin privileges revoked');
      }
      
      dispatch({ type: 'REFRESH_SUCCESS', payload: user });
    } catch (error) {
      dispatch({ type: 'REFRESH_FAILURE' });
      throw error;
    }
  };

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}