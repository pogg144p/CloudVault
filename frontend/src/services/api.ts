import axios from 'axios';

// In production (Render static site), VITE_API_BASE_URL points to the backend service URL.
// In local dev, we use the Vite proxy so relative '/api/v1' works fine.
const rawBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const BASE_URL = rawBase
  ? rawBase.endsWith('/api/v1')
    ? rawBase
    : `${rawBase}/api/v1`
  : '/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cloudvault_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401s and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('cloudvault_refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post('/api/v1/auth/refresh', {
            refresh_token: refreshToken,
          });
          const { access_token, refresh_token: newRefreshToken } = res.data;
          localStorage.setItem('cloudvault_access_token', access_token);
          if (newRefreshToken) {
            localStorage.setItem('cloudvault_refresh_token', newRefreshToken);
          }
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshErr) {
          localStorage.removeItem('cloudvault_access_token');
          localStorage.removeItem('cloudvault_refresh_token');
          window.location.href = '/';
        }
      }
    }
    return Promise.reject(error);
  }
);

export { BASE_URL };

/**
 * Returns an absolute URL for streaming or downloading a file asset
 * with JWT authentication attached as a query parameter (for standard HTML tags like <img>, <iframe>, <video>).
 */
export function getAuthenticatedAssetUrl(path: string): string {
  const token = localStorage.getItem('cloudvault_access_token');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${BASE_URL}${cleanPath}`;
  if (!token) return fullUrl;
  const separator = fullUrl.includes('?') ? '&' : '?';
  return `${fullUrl}${separator}token=${encodeURIComponent(token)}`;
}

export function getFilePreviewUrl(fileId: string): string {
  return getAuthenticatedAssetUrl(`/files/${fileId}/preview`);
}

export function getFileThumbnailUrl(fileId: string): string {
  return getAuthenticatedAssetUrl(`/files/${fileId}/thumbnail`);
}

export function getFileDownloadUrl(fileId: string): string {
  return getAuthenticatedAssetUrl(`/files/${fileId}/download`);
}

export default api;
