export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  parent_id?: string | null;
  name: string;
  path: string;
  color: string;
  is_favorite: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  files_count?: number;
  total_size_bytes?: number;
}

export interface FileItem {
  id: string;
  user_id: string;
  folder_id?: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  checksum_sha256?: string | null;
  current_version: number;
  thumbnail_url?: string | null;
  is_favorite: boolean;
  is_deleted: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorageBreakdown {
  category: string;
  total_bytes: number;
  files_count: number;
  color: string;
}

export interface StorageUsage {
  quota_bytes: number;
  used_bytes: number;
  free_bytes: number;
  percentage_used: number;
  breakdown: StorageBreakdown[];
}

export interface MonthlyStat {
  month: string;
  uploaded_bytes: number;
  uploaded_files_count: number;
}

export interface DashboardSummary {
  storage: StorageUsage;
  recent_files: FileItem[];
  quick_access: FileItem[];
  folder_categories: Folder[];
  monthly_stats: MonthlyStat[];
}
