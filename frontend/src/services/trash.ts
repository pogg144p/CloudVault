import api from './api';
import { FileItem, Folder } from '../types';

export interface TrashData {
  files: FileItem[];
  folders: Folder[];
}

export const trashService = {
  async getTrash(): Promise<TrashData> {
    const res = await api.get<TrashData>('/trash/');
    return res.data;
  },

  async restoreItem(itemId: string, itemType: 'file' | 'folder'): Promise<void> {
    await api.post('/trash/restore', {
      item_id: itemId,
      item_type: itemType,
    });
  },

  async purgeItem(itemId: string, itemType: 'file' | 'folder'): Promise<void> {
    await api.delete('/trash/purge', {
      data: {
        item_id: itemId,
        item_type: itemType,
      },
    });
  },
};
