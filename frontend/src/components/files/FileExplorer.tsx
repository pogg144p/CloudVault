import React, { useEffect, useState, useRef } from 'react';
import {
  Folder as FolderIcon,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Download,
  Trash2,
  Edit2,
  Plus,
  UploadCloud,
  ChevronRight,
  Home,
  Loader2,
  Share2,
  LayoutGrid,
  List,
  MoreHorizontal,
  Search,
  History,
  Eye,
} from 'lucide-react';
import { FileItem, Folder } from '../../types';
import { fileService, Breadcrumb, FolderDetails } from '../../services/files';
import { useAuth } from '../../context/AuthContext';
import { ShareModal } from './ShareModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { FilePreviewModal } from './FilePreviewModal';

interface FileExplorerProps {
  initialFolderId?: string;
  searchQuery?: string;
  onlyFavorites?: boolean;
  filterCategory?: 'pictures' | 'videos' | 'documents' | 'all';
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  initialFolderId = 'root',
  searchQuery = '',
  onlyFavorites = false,
  filterCategory = 'all',
}) => {
  const { refreshUser } = useAuth();
  const [currentFolderId, setCurrentFolderId] = useState<string>(initialFolderId);
  const [data, setData] = useState<FolderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Modal states
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#6366F1');

  // Rename states
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Share state
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);

  // Version History state
  const [versionTarget, setVersionTarget] = useState<FileItem | null>(null);

  // File Preview state
  const [previewTarget, setPreviewTarget] = useState<FileItem | null>(null);

  // File action dropdown state (for grid view)
  const [openFileMenu, setOpenFileMenu] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFolder = async (folderId: string) => {
    setLoading(true);
    try {
      const res = await fileService.getFolderDetails(folderId);
      setData(res);
      setCurrentFolderId(folderId);
    } catch (err) {
      console.error('Error loading folder', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolder(currentFolderId);
  }, [currentFolderId]);

  // Close file menu on outside click
  useEffect(() => {
    const handler = () => setOpenFileMenu(null);
    if (openFileMenu) {
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [openFileMenu]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const targetFolderId = currentFolderId === 'root' ? null : currentFolderId;
      for (let i = 0; i < files.length; i++) {
        await fileService.uploadFile(files[i], targetFolderId, (pct) => {
          setUploadProgress(pct);
        });
      }
      await loadFolder(currentFolderId);
      await refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'File upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const parentId = currentFolderId === 'root' ? null : currentFolderId;
      await fileService.createFolder(newFolderName.trim(), parentId, newFolderColor);
      setIsFolderModalOpen(false);
      setNewFolderName('');
      await loadFolder(currentFolderId);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create folder.');
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;

    try {
      if (renameTarget.type === 'folder') {
        await fileService.renameFolder(renameTarget.id, renameValue.trim());
      } else {
        await fileService.renameFile(renameTarget.id, renameValue.trim());
      }
      setRenameTarget(null);
      await loadFolder(currentFolderId);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Rename failed.');
    }
  };

  const handleDeleteFolder = async (folderId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the folder "${name}" and all its contents?`)) return;
    try {
      await fileService.deleteFolder(folderId);
      await loadFolder(currentFolderId);
      await refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete folder.');
    }
  };

  const handleDeleteFile = async (fileId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await fileService.deleteFile(fileId);
      await loadFolder(currentFolderId);
      await refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete file.');
    }
  };

  const handleDownload = async (file: FileItem) => {
    try {
      await fileService.downloadFile(file.id, file.name);
    } catch (err) {
      alert('Failed to download file.');
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime.includes('image')) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    if (mime.includes('video')) return <Video className="w-5 h-5 text-rose-500" />;
    if (mime.includes('audio')) return <Music className="w-5 h-5 text-amber-500" />;
    if (mime.includes('pdf')) return <FileText className="w-5 h-5 text-indigo-500" />;
    return <FileText className="w-5 h-5 text-slate-400" />;
  };

  const getFileIconLarge = (mime: string) => {
    if (mime.includes('image')) return <ImageIcon className="w-8 h-8 text-emerald-500" />;
    if (mime.includes('video')) return <Video className="w-8 h-8 text-rose-500" />;
    if (mime.includes('audio')) return <Music className="w-8 h-8 text-amber-500" />;
    if (mime.includes('pdf')) return <FileText className="w-8 h-8 text-indigo-500" />;
    return <FileText className="w-8 h-8 text-slate-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const filteredFiles = (data?.files || []).filter((f) => {
    if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (onlyFavorites && !f.is_favorite) {
      return false;
    }
    if (filterCategory === 'pictures' && !f.mime_type.includes('image')) {
      return false;
    }
    if (filterCategory === 'videos' && !f.mime_type.includes('video')) {
      return false;
    }
    if (
      filterCategory === 'documents' &&
      !f.mime_type.includes('pdf') &&
      !f.mime_type.includes('text') &&
      !f.mime_type.includes('document') &&
      !f.mime_type.includes('sheet')
    ) {
      return false;
    }
    return true;
  });

  const filteredFolders = (data?.subfolders || []).filter((fol) =>
    searchQuery ? fol.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  const isEmpty = filteredFiles.length === 0 && filteredFolders.length === 0;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* ──────────────────── 1. Breadcrumbs ──────────────────── */}
      <nav className="flex items-center space-x-1 text-sm overflow-x-auto py-1 scrollbar-none">
        {(data?.breadcrumbs || [{ id: null, name: 'All Files', path: '/' }]).map((crumb, idx, arr) => {
          const isLast = idx === arr.length - 1;
          return (
            <React.Fragment key={crumb.id || 'root'}>
              {idx === 0 ? (
                <button
                  onClick={() => setCurrentFolderId('root')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    isLast
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>{crumb.name}</span>
                </button>
              ) : (
                <button
                  onClick={() => crumb.id && setCurrentFolderId(crumb.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    isLast
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {crumb.name}
                </button>
              )}
              {!isLast && <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
            </React.Fragment>
          );
        })}
      </nav>

      {/* ──────────────────── 2. Action Bar ──────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60">
        {/* Left: folder info */}
        <p className="text-xs font-medium text-slate-400">
          {filteredFolders.length} {filteredFolders.length === 1 ? 'folder' : 'folders'}{' '}
          <span className="mx-1">·</span>{' '}
          {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
        </p>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            className="hidden"
          />

          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsFolderModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>New Folder</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-indigo-200 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UploadCloud className="w-4 h-4" />
            )}
            <span>{uploading ? `Uploading ${uploadProgress}%` : 'Upload File'}</span>
          </button>
        </div>
      </div>

      {/* ──────────────────── 3. Upload Progress Bar ──────────────────── */}
      {uploading && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-bold text-indigo-900">Uploading file…</span>
            <span className="text-xs font-bold text-indigo-600">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-indigo-200/60 h-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${uploadProgress}%`,
                background: 'linear-gradient(90deg, #6366F1, #8B5CF6)',
              }}
            />
          </div>
        </div>
      )}

      {/* ──────────────────── Main Content ──────────────────── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-xs font-medium">Loading folder contents…</p>
        </div>
      ) : isEmpty ? (
        /* ──────────────────── 6. Empty State ──────────────────── */
        <div className="bg-white rounded-2xl p-16 border-2 border-dashed border-slate-200 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <UploadCloud className="w-8 h-8 text-indigo-400" />
          </div>
          <h4 className="font-extrabold text-slate-700 text-base mb-1">
            This folder is empty
          </h4>
          <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6">
            Drop files here or click to upload your documents to CloudVault.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-200 inline-flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Choose Files</span>
          </button>
        </div>
      ) : (
        <>
          {/* ──────────────────── 4. Folders Grid ──────────────────── */}
          {filteredFolders.length > 0 && (
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                Folders ({filteredFolders.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredFolders.map((fol) => (
                  <div
                    key={fol.id}
                    onClick={() => setCurrentFolderId(fol.id)}
                    className="relative bg-white rounded-2xl p-4 border border-slate-100 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer group"
                  >
                    {/* Hover action buttons — top-right corner */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShareTarget({ id: fol.id, name: fol.name, type: 'folder' });
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Share folder"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameTarget({ id: fol.id, name: fol.name, type: 'folder' });
                          setRenameValue(fol.name);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Rename folder"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFolder(fol.id, fol.name);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete folder"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Folder content */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${fol.color}15`, color: fol.color }}
                      >
                        <FolderIcon className="w-5 h-5 fill-current" />
                      </div>
                      <div className="truncate min-w-0">
                        <h5 className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                          {fol.name}
                        </h5>
                        <span className="text-[10px] text-slate-400">
                          {fol.files_count ?? 0} files
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ──────────────────── 5. Files Section ──────────────────── */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
              Files ({filteredFiles.length})
            </h4>

            {filteredFiles.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center text-xs text-slate-400">
                No files in this folder yet.
              </div>
            ) : viewMode === 'list' ? (
              /* ── List View ── */
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4 w-8">
                        <input
                          type="checkbox"
                          disabled
                          className="rounded border-slate-300"
                          title="Select all (coming soon)"
                        />
                      </th>
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">Version</th>
                      <th className="py-3 px-4">Uploaded</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {filteredFiles.map((file) => (
                      <tr
                        key={file.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            disabled
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-slate-50 shrink-0">
                              {getFileIcon(file.mime_type)}
                            </div>
                            <span
                              onClick={() => setPreviewTarget(file)}
                              className="font-bold text-slate-800 truncate max-w-xs hover:text-indigo-600 cursor-pointer transition-colors"
                              title="Click to preview"
                            >
                              {file.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-medium">
                          {formatSize(file.size_bytes)}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => setVersionTarget(file)}
                            title="View Version History"
                            className="px-2 py-0.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-[10px] transition-colors cursor-pointer"
                          >
                            v{file.current_version}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(file.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => setPreviewTarget(file)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Preview file"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setVersionTarget(file)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Version History"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setShareTarget({ id: file.id, name: file.name, type: 'file' })}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Share link"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownload(file)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setRenameTarget({ id: file.id, name: file.name, type: 'file' });
                                setRenameValue(file.name);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Rename"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(file.id, file.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete"
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
            ) : (
              /* ── Grid View ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="relative bg-white rounded-2xl p-4 border border-slate-100 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 group"
                  >
                    {/* Dots menu */}
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenFileMenu(openFileMenu === file.id ? null : file.id);
                        }}
                        className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {/* Dropdown */}
                      {openFileMenu === file.id && (
                        <div className="absolute right-0 top-8 z-20 w-40 bg-white rounded-xl border border-slate-100 shadow-xl py-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewTarget(file);
                              setOpenFileMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> Preview
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVersionTarget(file);
                              setOpenFileMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <History className="w-3.5 h-3.5" /> Versions
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShareTarget({ id: file.id, name: file.name, type: 'file' });
                              setOpenFileMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <Share2 className="w-3.5 h-3.5" /> Share
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                              setOpenFileMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameTarget({ id: file.id, name: file.name, type: 'file' });
                              setRenameValue(file.name);
                              setOpenFileMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Rename
                          </button>
                          <div className="border-t border-slate-100 my-1" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(file.id, file.name);
                              setOpenFileMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* File content */}
                    <div
                      onClick={() => setPreviewTarget(file)}
                      className="flex flex-col items-center text-center pt-2 pb-1 cursor-pointer"
                      title="Click to preview"
                    >
                      <div className="w-full h-28 rounded-xl bg-slate-50 flex items-center justify-center mb-3 overflow-hidden">
                        {file.mime_type.startsWith('image/') ? (
                          <img
                            src={`/api/v1/files/${file.id}/thumbnail`}
                            alt={file.name}
                            className="w-full h-full object-cover rounded-xl"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          getFileIconLarge(file.mime_type)
                        )}
                      </div>
                      <h5 className="text-xs font-bold text-slate-800 truncate w-full mb-1 hover:text-indigo-600 transition-colors">
                        {file.name}
                      </h5>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {formatSize(file.size_bytes)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ──────────────────── 7a. Create Folder Modal ──────────────────── */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-extrabold text-slate-800 mb-1">Create New Folder</h3>
            <p className="text-xs text-slate-400 mb-4">
              Organize your documents inside {data?.folder ? data.folder.name : 'root'}.
            </p>

            <form onSubmit={handleCreateFolder}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design Assets, Tax 2026"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Folder Theme Color
                </label>
                <div className="flex items-center space-x-3">
                  {[
                    { color: '#6366F1', label: 'Indigo' },
                    { color: '#10B981', label: 'Emerald' },
                    { color: '#F59E0B', label: 'Amber' },
                    { color: '#EF4444', label: 'Rose' },
                    { color: '#8B5CF6', label: 'Purple' },
                    { color: '#0EA5E9', label: 'Sky' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setNewFolderColor(c.color)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        newFolderColor === c.color ? 'scale-125 ring-2 ring-offset-2 ring-indigo-500' : ''
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────── 7b. Rename Modal ──────────────────── */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-extrabold text-slate-800 mb-1">
              Rename {renameTarget.type === 'folder' ? 'Folder' : 'File'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter a new name for &quot;{renameTarget.name}&quot;.
            </p>

            <form onSubmit={handleRename}>
              <div className="mb-6">
                <input
                  type="text"
                  required
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────── 8. Share Modal ──────────────────── */}
      <ShareModal
        isOpen={!!shareTarget}
        target={shareTarget}
        onClose={() => setShareTarget(null)}
      />

      {/* ──────────────────── 9. Version History Modal ─────────── */}
      <VersionHistoryModal
        isOpen={!!versionTarget}
        file={versionTarget}
        onClose={() => setVersionTarget(null)}
        onVersionUpdated={() => {
          loadFolder(currentFolderId);
          refreshUser();
        }}
      />

      {/* ──────────────────── 10. File Preview Modal ──────────── */}
      <FilePreviewModal
        isOpen={!!previewTarget}
        file={previewTarget}
        onClose={() => setPreviewTarget(null)}
      />
    </div>
  );
};
