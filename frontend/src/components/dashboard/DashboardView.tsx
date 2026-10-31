import React, { useEffect, useState } from 'react';
import { FolderCard } from './FolderCard';
import { QuickAccessCard } from './QuickAccessCard';
import { RecentFilesList } from './RecentFilesList';
import { DashboardSummary, FileItem, Folder } from '../../types';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { HardDrive, FileText, Share2, FolderOpen } from 'lucide-react';

interface DashboardViewProps {
  onNavigateToFolder?: (folderId: string) => void;
}

interface StatCard {
  label: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val % 1 === 0 ? val : val.toFixed(1)} ${units[i]}`;
};

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateToFolder }) => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get<DashboardSummary>('/dashboard/summary');
        setSummary(res.data);
      } catch (err) {
        // Fallback demo state if not yet authenticated or empty db
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [user]);

  // --------------- derived data ---------------

  const usedBytes = summary?.storage?.used_bytes ?? 2.4 * 1024 * 1024 * 1024;
  const quotaBytes = summary?.storage?.quota_bytes ?? 15 * 1024 * 1024 * 1024;
  const storagePct = summary?.storage?.percentage_used ?? Math.round((usedBytes / quotaBytes) * 100);

  const totalFiles =
    summary?.storage?.breakdown?.reduce((sum, b) => sum + b.files_count, 0) ??
    summary?.recent_files?.length ??
    128;

  const folderCount = summary?.folder_categories?.length ?? 4;

  const statCards: StatCard[] = [
    {
      label: 'Total Storage',
      value: `${formatBytes(usedBytes)} / ${formatBytes(quotaBytes)}`,
      icon: HardDrive,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      label: 'Files',
      value: String(totalFiles),
      icon: FileText,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Shared',
      value: '0',
      icon: Share2,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: 'Folders',
      value: String(folderCount),
      icon: FolderOpen,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
    },
  ];

  // Default folder cards matching the Dribbble design reference exactly
  const folders: Folder[] = summary?.folder_categories?.length
    ? summary.folder_categories
    : [
        {
          id: 'f1',
          user_id: 'u1',
          name: 'Design',
          path: '/Design/',
          color: '#6366F1',
          is_favorite: true,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          files_count: 17,
          total_size_bytes: 12 * 1024 * 1024 * 1024,
        },
        {
          id: 'f2',
          user_id: 'u1',
          name: 'Documents',
          path: '/Documents/',
          color: '#10B981',
          is_favorite: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          files_count: 17,
          total_size_bytes: 12 * 1024 * 1024 * 1024,
        },
        {
          id: 'f3',
          user_id: 'u1',
          name: 'Music',
          path: '/Music/',
          color: '#F59E0B',
          is_favorite: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          files_count: 1200,
          total_size_bytes: 24 * 1024 * 1024 * 1024,
        },
        {
          id: 'f4',
          user_id: 'u1',
          name: 'Images',
          path: '/Images/',
          color: '#EF4444',
          is_favorite: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          files_count: 270,
          total_size_bytes: 12 * 1024 * 1024 * 1024,
        },
      ];

  // Quick access files matching reference
  const quickAccess: FileItem[] = summary?.quick_access?.length
    ? summary.quick_access
    : [
        {
          id: 'qa1',
          user_id: 'u1',
          name: 'Building Image.jpeg',
          mime_type: 'image/jpeg',
          size_bytes: 4.2 * 1024 * 1024,
          storage_key: 'building.jpg',
          current_version: 1,
          is_favorite: true,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'qa2',
          user_id: 'u1',
          name: 'Product Video.mp4',
          mime_type: 'video/mp4',
          size_bytes: 48 * 1024 * 1024,
          storage_key: 'product.mp4',
          current_version: 1,
          is_favorite: true,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'qa3',
          user_id: 'u1',
          name: 'Customers.pdf',
          mime_type: 'application/pdf',
          size_bytes: 2.1 * 1024 * 1024,
          storage_key: 'customers.pdf',
          current_version: 1,
          is_favorite: true,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

  // Storage breakdown categories
  const breakdownCategories = summary?.storage?.breakdown?.length
    ? summary.storage.breakdown
    : [
        { category: 'Images', total_bytes: 1.2 * 1024 * 1024 * 1024, files_count: 48, color: '#6366F1' },
        { category: 'Documents', total_bytes: 0.6 * 1024 * 1024 * 1024, files_count: 35, color: '#10B981' },
        { category: 'Videos', total_bytes: 0.4 * 1024 * 1024 * 1024, files_count: 12, color: '#F59E0B' },
        { category: 'Others', total_bytes: 0.2 * 1024 * 1024 * 1024, files_count: 33, color: '#EF4444' },
      ];

  // --------------- skeleton ---------------

  if (loading) {
    return (
      <div className="space-y-8 max-w-6xl animate-pulse">
        <div className="h-28 rounded-2xl bg-slate-100" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* ─── 1. Welcome Banner ─── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 px-8 py-8 text-white shadow-lg shadow-indigo-200/40">
        {/* decorative circles */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -right-4 bottom-0 h-24 w-24 rounded-full bg-white/5" />

        <h2 className="text-2xl font-extrabold leading-tight tracking-tight">
          {user ? `Welcome back, ${user.full_name}` : 'Welcome to CloudVault'}
        </h2>
        <p className="mt-1 text-sm font-medium text-indigo-100">
          {user ? 'Manage your files and folders' : 'Sign in to start managing your files'}
        </p>
      </section>

      {/* ─── 2. Storage Overview Cards ─── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 transition-shadow hover:shadow-md"
            >
              <div className={`w-11 h-11 rounded-full ${card.iconBg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <div>
                <span className="text-xl font-extrabold text-slate-800 leading-none">{card.value}</span>
                <p className="mt-1 text-xs font-medium text-slate-400">{card.label}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* ─── 3. Folder Categories Grid ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-slate-800 text-lg">Folder Categories</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onClick={() => onNavigateToFolder && onNavigateToFolder(folder.id)}
            />
          ))}
        </div>
      </section>

      {/* ─── 4. Quick Access + Storage Breakdown ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Quick Access (takes 2 cols) */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-slate-800 text-lg">Quick Access</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {quickAccess.map((file, idx) => {
              const previewSamples = [
                'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
                'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80',
                'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
              ];
              return (
                <QuickAccessCard
                  key={file.id}
                  file={file}
                  previewUrl={previewSamples[idx % previewSamples.length]}
                  onClick={() => onNavigateToFolder && onNavigateToFolder('root')}
                />
              );
            })}
          </div>
        </div>

        {/* Right — Storage Breakdown Ring */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center">
          <h3 className="font-extrabold text-slate-800 text-base mb-6 self-start">Storage</h3>

          {/* Donut Ring */}
          <div className="relative w-40 h-40 mx-auto">
            <svg viewBox="0 0 36 36" className="w-full h-full">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#6366F1"
                strokeWidth="3"
                strokeDasharray={`${storagePct}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-slate-800">{storagePct}%</span>
              <span className="text-xs text-slate-400">Used</span>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="w-full mt-6 space-y-3">
            {breakdownCategories.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-medium text-slate-600">{cat.category}</span>
                </div>
                <span className="font-semibold text-slate-800">{formatBytes(cat.total_bytes)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 5. Recent Files ─── */}
      <section>
        <RecentFilesList
          files={summary?.recent_files ?? []}
          onOpenFileManager={() => onNavigateToFolder && onNavigateToFolder('root')}
        />
      </section>
    </div>
  );
};
