import { apiService } from './api';
import { AdminUser } from '../types';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  user: AdminUser;
  token: string;
}

export class AuthService {
  async login(email: string, password: string): Promise<LoginResponse> {
    const data: LoginRequest = { email, password };
    const response = await apiService.post<LoginResponse>('/auth/login', data);
    
    // Verify the user has admin privileges
    if (!response.user.isSystemAdmin) {
      throw new Error('Access denied. System administrator privileges required.');
    }
    
    return response;
  }

  async getCurrentUser(): Promise<AdminUser> {
    return apiService.get<AdminUser>('/auth/me');
  }

  async refreshToken(): Promise<LoginResponse> {
    return apiService.post<LoginResponse>('/auth/refresh');
  }

  logout(): void {
    localStorage.removeItem('admin_token');
  }
}

export const authService = new AuthService();