import api from './api';
import { FileItem, Folder } from '../types';

export interface Breadcrumb {
  id: string | null;
  name: string;
  path: string;
}

export interface FolderDetails {
  folder: Folder | null;
  breadcrumbs: Breadcrumb[];
  subfolders: Folder[];
  files: FileItem[];
}

export const fileService = {
  // Folder Operations
  async getFolderDetails(folderId: string = 'root'): Promise<FolderDetails> {
    const res = await api.get<FolderDetails>(`/folders/${folderId}`);
    return res.data;
  },

  async createFolder(name: string, parentId?: string | null, color?: string): Promise<Folder> {
    const res = await api.post<Folder>('/folders/', {
      name,
      parent_id: parentId || null,
      color: color || '#4F46E5',
    });
    return res.data;
  },

  async renameFolder(folderId: string, name: string): Promise<Folder> {
    const res = await api.put<Folder>(`/folders/${folderId}`, { name });
    return res.data;
  },

  async deleteFolder(folderId: string): Promise<void> {
    await api.delete(`/folders/${folderId}`);
  },

  // File Operations
  async uploadFile(
    file: File,
    folderId?: string | null,
    onProgress?: (percent: number) => void
  ): Promise<FileItem> {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
      formData.append('folder_id', folderId);
    }

    const res = await api.post<FileItem>('/files/upload', formData, {
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

  async renameFile(fileId: string, name: string): Promise<FileItem> {
    const res = await api.put<FileItem>(`/files/${fileId}`, { name });
    return res.data;
  },

  async deleteFile(fileId: string): Promise<void> {
    await api.delete(`/files/${fileId}`);
  },

  async downloadFile(fileId: string, fileName: string): Promise<void> {
    const res = await api.get(`/files/${fileId}/download`, {
      responseType: 'blob',
    });

    // Create a temporary link and trigger browser download
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
