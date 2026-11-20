import api from './api';
import { User } from '../types';

export const adminService = {
  async listUsers(): Promise<User[]> {
    const res = await api.get<User[]>('/admin/users');
    return res.data;
  },

  async setUserRole(userId: string, isAdmin: boolean): Promise<User> {
    const res = await api.patch<User>(`/admin/users/${userId}/role`, null, {
      params: { is_admin: isAdmin },
    });
    return res.data;
  },
};
