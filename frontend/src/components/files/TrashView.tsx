import React, { useEffect, useState } from 'react';
import {
  Trash2,
  RotateCcw,
  Folder as FolderIcon,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { FileItem, Folder } from '../../types';
import { trashService, TrashData } from '../../services/trash';
import { useAuth } from '../../context/AuthContext';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const TrashView: React.FC = () => {
  const { refreshUser } = useAuth();
  const [data, setData] = useState<TrashData>({ files: [], folders: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadTrash = async () => {
    setLoading(true);
    try {
      const res = await trashService.getTrash();
      setData(res);
    } catch (err) {
      console.error('Failed to load trash', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (id: string, type: 'file' | 'folder', name: string) => {
    setActionLoading(id);
    try {
      await trashService.restoreItem(id, type);
      await loadTrash();
      await refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.detail || `Failed to restore ${type}.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePurge = async (id: string, type: 'file' | 'folder', name: string) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete "${name}"? This action CANNOT be undone and will permanently erase all data.`
      )
    )
      return;

    setActionLoading(id);
    try {
      await trashService.purgeItem(id, type);
      await loadTrash();
      await refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.detail || `Failed to permanently delete ${type}.`);
    } finally {
      setActionLoading(null);
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime.includes('image')) return <ImageIcon className="w-4 h-4 text-emerald-500" />;
    if (mime.includes('video')) return <Video className="w-4 h-4 text-rose-500" />;
    if (mime.includes('audio')) return <Music className="w-4 h-4 text-amber-500" />;
    if (mime.includes('pdf')) return <FileText className="w-4 h-4 text-indigo-500" />;
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  const totalItems = data.files.length + data.folders.length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-800">Recycle Bin</h2>
          </div>
          <p className="text-xs text-slate-400">
            Items in the trash can be restored to your active vault or permanently erased.
          </p>
        </div>

        <div className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
          {totalItems} {totalItems === 1 ? 'item' : 'items'} in trash
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-xs font-medium">Loading deleted items...</p>
        </div>
      ) : totalItems === 0 ? (
        <div className="bg-white rounded-3xl p-16 border-2 border-dashed border-slate-200 text-center max-w-lg mx-auto mt-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center mx-auto mb-3">
            <Trash2 className="w-7 h-7" />
          </div>
          <h4 className="font-extrabold text-slate-700 text-base mb-1">
            Recycle Bin is Empty
          </h4>
          <p className="text-xs text-slate-400">
            Deleted files and folders will appear here before being permanently removed.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Deleted Folders */}
          {data.folders.length > 0 && (
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                Deleted Folders ({data.folders.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.folders.map((folder) => {
                  const isBusy = actionLoading === folder.id;
                  return (
                    <div
                      key={folder.id}
                      className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${folder.color}15`, color: folder.color }}
                        >
                          <FolderIcon className="w-5 h-5 fill-current" />
                        </div>
                        <div className="truncate">
                          <h5 className="text-xs font-bold text-slate-800 truncate">
                            {folder.name}
                          </h5>
                          <span className="text-[10px] text-slate-400">
                            Folder
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleRestore(folder.id, 'folder', folder.name)}
                          disabled={isBusy}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Restore folder"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePurge(folder.id, 'folder', folder.name)}
                          disabled={isBusy}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Deleted Files */}
          {data.files.length > 0 && (
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                Deleted Files ({data.files.length})
              </h4>
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-[#FAFBFD] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">Deleted At</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {data.files.map((file) => {
                      const isBusy = actionLoading === file.id;
                      return (
                        <tr key={file.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 flex items-center space-x-3">
                            <div className="p-2 rounded-xl bg-slate-50 shrink-0">
                              {getFileIcon(file.mime_type)}
                            </div>
                            <span className="font-bold text-slate-800 truncate max-w-xs">
                              {file.name}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-medium">
                            {formatBytes(file.size_bytes)}
                          </td>
                          <td className="py-3 px-4 text-slate-400">
                            {file.deleted_at
                              ? new Date(file.deleted_at).toLocaleString()
                              : 'Recently'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleRestore(file.id, 'file', file.name)}
                                disabled={isBusy}
                                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Restore</span>
                              </button>
                              <button
                                onClick={() => handlePurge(file.id, 'file', file.name)}
                                disabled={isBusy}
                                className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Purge</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
