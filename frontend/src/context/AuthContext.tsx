import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('cloudvault_access_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get<User>('/auth/me');
      setUser(response.data);
    } catch (err) {
      localStorage.removeItem('cloudvault_access_token');
      localStorage.removeItem('cloudvault_refresh_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { access_token, refresh_token } = response.data;
    localStorage.setItem('cloudvault_access_token', access_token);
    if (refresh_token) {
      localStorage.setItem('cloudvault_refresh_token', refresh_token);
    }
    await fetchCurrentUser();
  };

  const register = async (email: string, name: string, password: string) => {
    const response = await api.post('/auth/register', {
      email,
      full_name: name,
      password,
    });
    const { access_token, refresh_token } = response.data;
    localStorage.setItem('cloudvault_access_token', access_token);
    if (refresh_token) {
      localStorage.setItem('cloudvault_refresh_token', refresh_token);
    }
    await fetchCurrentUser();
  };

  const logout = () => {
    localStorage.removeItem('cloudvault_access_token');
    localStorage.removeItem('cloudvault_refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
