import api from './api';

export interface ShareResponse {
  id: string;
  share_token: string;
  created_by: string;
  file_id?: string | null;
  folder_id?: string | null;
  permission: string;
  has_password: boolean;
  expires_at?: string | null;
  shared_with_email?: string | null;
  created_at: string;
}

export interface PublicShareItem {
  share_token: string;
  permission: string;
  is_expired: boolean;
  requires_password: boolean;
  item_type: 'file' | 'folder';
  item_id?: string | null;
  item_name?: string | null;
  item_size_bytes?: number | null;
  item_mime_type?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export const shareService = {
  async createShare(params: {
    file_id?: string;
    folder_id?: string;
    permission: 'view' | 'download' | 'edit';
    password?: string;
    expires_at?: string;
  }): Promise<ShareResponse> {
    const res = await api.post<ShareResponse>('/shares/', params);
    return res.data;
  },

  async getMyShares(): Promise<ShareResponse[]> {
    const res = await api.get<ShareResponse[]>('/shares/');
    return res.data;
  },

  async revokeShare(shareId: string): Promise<void> {
    await api.delete(`/shares/${shareId}`);
  },

  async getPublicShare(token: string, password?: string): Promise<PublicShareItem> {
    const query = password ? `?password=${encodeURIComponent(password)}` : '';
    const res = await api.get<PublicShareItem>(`/shares/public/${token}${query}`);
    return res.data;
  },

  async verifyPassword(token: string, password: string): Promise<PublicShareItem> {
    const res = await api.post<PublicShareItem>(`/shares/public/${token}/verify`, { password });
    return res.data;
  },

  async downloadPublicSharedFile(token: string, fileName: string, password?: string): Promise<void> {
    const query = password ? `?password=${encodeURIComponent(password)}` : '';
    const res = await api.get(`/shares/public/${token}/download${query}`, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
