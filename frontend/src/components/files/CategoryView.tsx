import React, { useEffect, useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  UploadCloud,
  Download,
  Trash2,
  Edit2,
  Share2,
  History,
  Eye,
  Heart,
  LayoutGrid,
  List,
  MoreHorizontal,
  Loader2,
  Clock,
  HardDrive,
} from 'lucide-react';
import { FileItem } from '../../types';
import { fileService } from '../../services/files';
import { getFileThumbnailUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ShareModal } from './ShareModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { FilePreviewModal } from './FilePreviewModal';
import { CategoryMismatchModal, MismatchedFileItem } from './CategoryMismatchModal';
import { classifyFile } from '../../utils/fileClassifier';

export type FileCategory = 'pictures' | 'videos' | 'documents' | 'music';

interface CategoryViewProps {
  category: FileCategory;
  searchQuery?: string;
}

const CATEGORY_CONFIG: Record<
  FileCategory,
  {
    title: string;
    icon: React.ElementType;
    accentColor: string;
    bgColor: string;
    darkBgColor: string;
    accept: string;
    emptyTitle: string;
    emptyDesc: string;
    uploadLabel: string;
  }
> = {
  pictures: {
    title: 'Images',
    icon: ImageIcon,
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 text-emerald-600',
    darkBgColor: 'dark:bg-emerald-950/50 dark:text-emerald-400',
    accept: 'image/*',
    emptyTitle: 'No images in your vault',
    emptyDesc: 'Upload PNG, JPEG, GIF, SVG or WebP images to organize your photo library.',
    uploadLabel: 'Upload Image',
  },
  videos: {
    title: 'Videos',
    icon: Video,
    accentColor: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 text-rose-600',
    darkBgColor: 'dark:bg-rose-950/50 dark:text-rose-400',
    accept: 'video/*',
    emptyTitle: 'No videos in your vault',
    emptyDesc: 'Upload MP4, WebM, or MOV video files to stream and store in CloudVault.',
    uploadLabel: 'Upload Video',
  },
  documents: {
    title: 'Documents',
    icon: FileText,
    accentColor: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 text-indigo-600',
    darkBgColor: 'dark:bg-indigo-950/50 dark:text-indigo-400',
    accept: '.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.json,.md',
    emptyTitle: 'No documents in your vault',
    emptyDesc: 'Upload PDFs, text documents, spreadsheets or presentations.',
    uploadLabel: 'Upload Document',
  },
  music: {
    title: 'Music & Audio',
    icon: Music,
    accentColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 text-amber-600',
    darkBgColor: 'dark:bg-amber-950/50 dark:text-amber-400',
    accept: 'audio/*',
    emptyTitle: 'No audio files in your vault',
    emptyDesc: 'Upload MP3, WAV, AAC, or FLAC audio files to listen and manage.',
    uploadLabel: 'Upload Audio',
  },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

export const CategoryView: React.FC<CategoryViewProps> = ({
  category,
  searchQuery = '',
}) => {
  const { refreshUser } = useAuth();
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Modals
  const [previewTarget, setPreviewTarget] = useState<FileItem | null>(null);
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [versionTarget, setVersionTarget] = useState<FileItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [openFileMenu, setOpenFileMenu] = useState<string | null>(null);

  // Category Mismatch Modal State
  const [mismatchModalOpen, setMismatchModalOpen] = useState(false);
  const [pendingMismatches, setPendingMismatches] = useState<MismatchedFileItem[]>([]);
  const [pendingMatches, setPendingMatches] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const data = await fileService.listFiles({
        category,
        search: searchQuery || undefined,
      });
      // Already returned in recent order from backend (created_at desc)
      setFiles(data);
    } catch (err) {
      console.error(`Failed to load ${category} files`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [category, searchQuery]);

  // Close context menu on outside click
  useEffect(() => {
    const handler = () => setOpenFileMenu(null);
    if (openFileMenu) {
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [openFileMenu]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    const filesArray = Array.from(selected);
    const matches: File[] = [];
    const mismatches: MismatchedFileItem[] = [];

    filesArray.forEach((f) => {
      const detected = classifyFile(f.name, f.type);
      if (detected === category) {
        matches.push(f);
      } else {
        mismatches.push({ file: f, detectedCategory: detected });
      }
    });

    if (mismatches.length > 0) {
      setPendingMismatches(mismatches);
      setPendingMatches(matches);
      setMismatchModalOpen(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      executeUpload(matches, []);
    }
  };

  const executeUpload = async (directFiles: File[], autoSortFiles: File[]) => {
    setUploading(true);
    setUploadProgress(0);

    const totalCount = directFiles.length + autoSortFiles.length;
    let completed = 0;

    try {
      // 1. Upload files matching current category
      for (const f of directFiles) {
        await fileService.uploadFile(f, null, (pct) => {
          const overall = Math.round(((completed + pct / 100) / totalCount) * 100);
          setUploadProgress(overall);
        });
        completed++;
      }

      // 2. Upload auto-sorted files to their designated area
      for (const f of autoSortFiles) {
        await fileService.uploadFile(
          f,
          null,
          (pct) => {
            const overall = Math.round(((completed + pct / 100) / totalCount) * 100);
            setUploadProgress(overall);
          },
          true
        );
        completed++;
      }

      await loadFiles();
      await refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'File upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setPendingMatches([]);
      setPendingMismatches([]);
      setMismatchModalOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAutoSortConfirm = () => {
    const autoSortList = pendingMismatches.map((m) => m.file);
    executeUpload(pendingMatches, autoSortList);
  };

  const handleSkipConfirm = () => {
    if (pendingMatches.length > 0) {
      executeUpload(pendingMatches, []);
    } else {
      setPendingMatches([]);
      setPendingMismatches([]);
      setMismatchModalOpen(false);
    }
  };

  const handleCancelMismatch = () => {
    setPendingMatches([]);
    setPendingMismatches([]);
    setMismatchModalOpen(false);
  };

  const handleToggleFavorite = async (file: FileItem) => {
    try {
      const updated = await fileService.toggleFavorite(file.id, file.is_favorite);
      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, is_favorite: updated.is_favorite } : f)));
    } catch (err) {
      console.error('Failed to toggle favorite', err);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;

    try {
      await fileService.renameFile(renameTarget.id, renameValue.trim());
      setRenameTarget(null);
      await loadFiles();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Rename failed.');
    }
  };

  const handleDeleteFile = async (fileId: string, name: string) => {
    if (!confirm(`Are you sure you want to move "${name}" to the Trash?`)) return;
    try {
      await fileService.deleteFile(fileId);
      await loadFiles();
      await refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete file.');
    }
  };

  const totalBytes = files.reduce((acc, f) => acc + (f.size_bytes || 0), 0);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ── Category Header & Controls ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className={`p-2.5 rounded-2xl ${config.bgColor} ${config.darkBgColor} shadow-sm`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                {config.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 font-medium">
                <span>{files.length} {files.length === 1 ? 'file' : 'files'}</span>
                <span>•</span>
                <span>{formatSize(totalBytes)} total</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold">
                  <Clock className="w-3 h-3" /> Recent Order
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          {/* View mode toggle */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-200 dark:shadow-none"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UploadCloud className="w-4 h-4" />
            )}
            <span>{uploading ? `Uploading ${uploadProgress}%` : config.uploadLabel}</span>
          </button>
        </div>
      </div>

      {/* Upload progress banner */}
      {uploading && (
        <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950/50 rounded-2xl p-4 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              Uploading to vault...
            </span>
            <span className="text-indigo-600 dark:text-indigo-400">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-300 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Content Area ── */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-xs font-medium">Loading {config.title.toLowerCase()}...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 border-2 border-dashed border-slate-200 dark:border-slate-800 text-center max-w-lg mx-auto mt-8">
          <div className={`w-16 h-16 rounded-3xl ${config.bgColor} ${config.darkBgColor} flex items-center justify-center mx-auto mb-4 shadow-sm`}>
            <Icon className="w-8 h-8" />
          </div>
          <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-base mb-1">
            {config.emptyTitle}
          </h4>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 max-w-xs mx-auto">
            {config.emptyDesc}
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-200 dark:shadow-none inline-flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{config.uploadLabel}</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Grid View ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="group relative bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 hover:shadow-xl dark:hover:shadow-slate-950/80 hover:scale-[1.02] transition-all duration-200 flex flex-col justify-between"
            >
              {/* Top Bar on Card */}
              <div className="flex items-center justify-between mb-2 z-10">
                <button
                  onClick={() => handleToggleFavorite(file)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    file.is_favorite
                      ? 'text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/40'
                      : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  title={file.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart className={`w-3.5 h-3.5 ${file.is_favorite ? 'fill-current' : ''}`} />
                </button>

                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenFileMenu(openFileMenu === file.id ? null : file.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {openFileMenu === file.id && (
                    <div className="absolute right-0 top-8 z-30 w-44 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-xl py-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewTarget(file);
                          setOpenFileMenu(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setVersionTarget(file);
                          setOpenFileMenu(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <History className="w-3.5 h-3.5" /> Version History
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShareTarget({ id: file.id, name: file.name, type: 'file' });
                          setOpenFileMenu(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Share
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fileService.downloadFile(file.id, file.name);
                          setOpenFileMenu(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameTarget({ id: file.id, name: file.name });
                          setRenameValue(file.name);
                          setOpenFileMenu(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Rename
                      </button>
                      <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.id, file.name);
                          setOpenFileMenu(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Move to Trash
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Thumbnail / Media Box */}
              <div
                onClick={() => setPreviewTarget(file)}
                className="w-full h-36 rounded-xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center overflow-hidden cursor-pointer relative group-hover:opacity-95 transition-all"
                title="Click to preview"
              >
                {category === 'pictures' ? (
                  <img
                    src={getFileThumbnailUrl(file.id)}
                    alt={file.name}
                    className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className={`p-4 rounded-2xl ${config.bgColor} ${config.darkBgColor} transition-transform group-hover:scale-110`}>
                    <Icon className="w-8 h-8" />
                  </div>
                )}

                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="p-2 rounded-xl bg-white/90 text-slate-900 shadow-lg text-xs font-bold flex items-center gap-1.5 backdrop-blur-sm">
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </span>
                </div>
              </div>

              {/* Title & Info */}
              <div className="pt-3">
                <h5
                  onClick={() => setPreviewTarget(file)}
                  className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate w-full cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title={file.name}
                >
                  {file.name}
                </h5>
                <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                  <span>{formatSize(file.size_bytes)}</span>
                  <span>{formatDate(file.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── List View ── */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-[#FAFBFD] dark:bg-slate-800/60 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Uploaded</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/80 text-xs">
              {files.map((file) => (
                <tr
                  key={file.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  <td className="py-3 px-4 flex items-center space-x-3">
                    <button
                      onClick={() => handleToggleFavorite(file)}
                      className={`transition-colors ${
                        file.is_favorite
                          ? 'text-amber-500 fill-current'
                          : 'text-slate-300 dark:text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${file.is_favorite ? 'fill-current' : ''}`} />
                    </button>
                    <div className={`p-2 rounded-xl ${config.bgColor} ${config.darkBgColor} shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      onClick={() => setPreviewTarget(file)}
                      className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-sm hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                      title="Click to preview"
                    >
                      {file.name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-medium">
                    {formatSize(file.size_bytes)}
                  </td>
                  <td className="py-3 px-4 text-slate-400 dark:text-slate-500">
                    {formatDate(file.created_at)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setPreviewTarget(file)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setVersionTarget(file)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Version History"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShareTarget({ id: file.id, name: file.name, type: 'file' })}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Share link"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => fileService.downloadFile(file.id, file.name)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setRenameTarget({ id: file.id, name: file.name });
                          setRenameValue(file.name);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Rename"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.id, file.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                        title="Move to Trash"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ── */}
      <FilePreviewModal
        isOpen={!!previewTarget}
        file={previewTarget}
        onClose={() => setPreviewTarget(null)}
      />

      {shareTarget && (
        <ShareModal
          isOpen={true}
          target={shareTarget}
          onClose={() => setShareTarget(null)}
        />
      )}

      {versionTarget && (
        <VersionHistoryModal
          isOpen={true}
          file={versionTarget}
          onClose={() => setVersionTarget(null)}
          onVersionUpdated={loadFiles}
        />
      )}

      {renameTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRename}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-100 dark:border-slate-800 shadow-xl space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Rename File
            </h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Category Mismatch & Auto-Sort Modal */}
      <CategoryMismatchModal
        isOpen={mismatchModalOpen}
        currentCategory={category}
        mismatchedFiles={pendingMismatches}
        matchingCount={pendingMatches.length}
        onAutoSort={handleAutoSortConfirm}
        onSkip={handleSkipConfirm}
        onCancel={handleCancelMismatch}
      />
    </div>
  );
};
