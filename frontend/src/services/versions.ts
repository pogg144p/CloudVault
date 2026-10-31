import api from './api';
import { FileItem } from '../types';

export interface FileVersionItem {
  id: string;
  version_number: number;
  size_bytes: number;
  checksum_sha256?: string | null;
  uploaded_by: string;
  created_at: string;
}

export const versionService = {
  async getFileVersions(fileId: string): Promise<FileVersionItem[]> {
    const res = await api.get<FileVersionItem[]>(`/files/${fileId}/versions`);
    return res.data;
  },

  async uploadNewVersion(
    fileId: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<FileItem> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post<FileItem>(`/files/${fileId}/versions`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return res.data;
  },

  async restoreFileVersion(fileId: string, versionNumber: number): Promise<FileItem> {
    const res = await api.post<FileItem>(`/files/${fileId}/versions/${versionNumber}/restore`);
    return res.data;
  },

  async downloadFileVersion(fileId: string, versionNumber: number, fileName: string): Promise<void> {
    const res = await api.get(`/files/${fileId}/versions/${versionNumber}/download`, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `v${versionNumber}_${fileName}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
