import React, { useEffect, useState, useMemo } from 'react';
import {
  Trash2,
  RotateCcw,
  Folder as FolderIcon,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Loader2,
  CheckSquare,
  Square,
  MinusSquare,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { FileItem, Folder } from '../../types';
import { trashService, TrashData } from '../../services/trash';
import { useAuth } from '../../context/AuthContext';

type TrashCategory = 'all' | 'pictures' | 'videos' | 'documents' | 'music' | 'folders';

interface TrashItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  category: 'pictures' | 'videos' | 'documents' | 'music' | 'folders' | 'other';
  size_bytes?: number;
  mime_type?: string;
  color?: string;
  deleted_at?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileCategory(mime: string, name: string): TrashItem['category'] {
  const m = mime.toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith('image/')) return 'pictures';
  if (m.startsWith('video/')) return 'videos';
  if (m.startsWith('audio/')) return 'music';
  if (
    m.includes('pdf') ||
    m.includes('text') ||
    m.includes('document') ||
    m.includes('sheet') ||
    n.endsWith('.pdf') ||
    n.endsWith('.doc') ||
    n.endsWith('.docx') ||
    n.endsWith('.txt') ||
    n.endsWith('.md') ||
    n.endsWith('.csv') ||
    n.endsWith('.xlsx')
  ) {
    return 'documents';
  }
  return 'other';
}

export const TrashView: React.FC = () => {
  const { refreshUser } = useAuth();
  const [data, setData] = useState<TrashData>({ files: [], folders: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<TrashCategory>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadTrash = async () => {
    setLoading(true);
    try {
      const res = await trashService.getTrash();
      setData(res);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to load trash', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, []);

  // Map into unified list with category tag
  const allItems: TrashItem[] = useMemo(() => {
    const folderItems: TrashItem[] = data.folders.map((f) => ({
      id: f.id,
      name: f.name,
      type: 'folder',
      category: 'folders',
      color: f.color,
      deleted_at: f.updated_at,
    }));

    const fileItems: TrashItem[] = data.files.map((f) => ({
      id: f.id,
      name: f.name,
      type: 'file',
      category: getFileCategory(f.mime_type, f.name),
      size_bytes: f.size_bytes,
      mime_type: f.mime_type,
      deleted_at: f.deleted_at,
    }));

    return [...folderItems, ...fileItems];
  }, [data]);

  // Category counts
  const categoryCounts = useMemo(() => {
    return {
      all: allItems.length,
      pictures: allItems.filter((i) => i.category === 'pictures').length,
      videos: allItems.filter((i) => i.category === 'videos').length,
      documents: allItems.filter((i) => i.category === 'documents').length,
      music: allItems.filter((i) => i.category === 'music').length,
      folders: allItems.filter((i) => i.type === 'folder').length,
    };
  }, [allItems]);

  // Filtered by selected category
  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return allItems;
    if (activeCategory === 'folders') return allItems.filter((i) => i.type === 'folder');
    return allItems.filter((i) => i.category === activeCategory);
  }, [allItems, activeCategory]);

  // Selection toggle
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all in current category
  const handleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  // Restore single item
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

  // Purge single item
  const handlePurge = async (id: string, type: 'file' | 'folder', name: string) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete "${name}"? This action CANNOT be undone.`
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

  // Bulk restore selected checklist items
  const handleBulkRestore = async () => {
    const selected = allItems.filter((i) => selectedIds.has(i.id));
    if (selected.length === 0) return;

    setActionLoading('bulk');
    try {
      await Promise.all(
        selected.map((item) => trashService.restoreItem(item.id, item.type))
      );
      await loadTrash();
      await refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to restore some selected items.');
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk purge selected checklist items
  const handleBulkPurge = async () => {
    const selected = allItems.filter((i) => selectedIds.has(i.id));
    if (selected.length === 0) return;

    if (
      !confirm(
        `Are you sure you want to permanently delete these ${selected.length} items? This action CANNOT be undone.`
      )
    )
      return;

    setActionLoading('bulk');
    try {
      await Promise.all(
        selected.map((item) => trashService.purgeItem(item.id, item.type))
      );
      await loadTrash();
      await refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to permanently delete selected items.');
    } finally {
      setActionLoading(null);
    }
  };

  // Empty entire trash
  const handleEmptyTrash = async () => {
    if (allItems.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to empty the trash (${allItems.length} items)? This will permanently erase all files and folders.`
      )
    )
      return;

    setActionLoading('bulk');
    try {
      await Promise.all(
        allItems.map((item) => trashService.purgeItem(item.id, item.type))
      );
      await loadTrash();
      await refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to empty trash.');
    } finally {
      setActionLoading(null);
    }
  };

  const getCategoryIcon = (category: TrashItem['category'], type: 'file' | 'folder') => {
    if (type === 'folder') return <FolderIcon className="w-4 h-4 text-amber-500" />;
    if (category === 'pictures') return <ImageIcon className="w-4 h-4 text-emerald-500" />;
    if (category === 'videos') return <Video className="w-4 h-4 text-rose-500" />;
    if (category === 'music') return <Music className="w-4 h-4 text-amber-500" />;
    if (category === 'documents') return <FileText className="w-4 h-4 text-indigo-500" />;
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  const isAllSelected =
    filteredItems.length > 0 && selectedIds.size === filteredItems.length;
  const isPartiallySelected =
    selectedIds.size > 0 && selectedIds.size < filteredItems.length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shadow-sm">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                Recycle Bin
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Categorized checklist to restore or permanently erase items.
              </p>
            </div>
          </div>
        </div>

        {allItems.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleEmptyTrash}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Empty Trash</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Category Filter Pills (Checklist Filters) ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveCategory('all')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
            activeCategory === 'all'
              ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Items</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200/50 dark:bg-slate-700 text-[10px]">
            {categoryCounts.all}
          </span>
        </button>

        <button
          onClick={() => setActiveCategory('pictures')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
            activeCategory === 'pictures'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
          <span>Images</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200/50 dark:bg-slate-700 text-[10px]">
            {categoryCounts.pictures}
          </span>
        </button>

        <button
          onClick={() => setActiveCategory('videos')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
            activeCategory === 'videos'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <Video className="w-3.5 h-3.5 text-rose-500" />
          <span>Videos</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200/50 dark:bg-slate-700 text-[10px]">
            {categoryCounts.videos}
          </span>
        </button>

        <button
          onClick={() => setActiveCategory('documents')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
            activeCategory === 'documents'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-indigo-500" />
          <span>Documents</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200/50 dark:bg-slate-700 text-[10px]">
            {categoryCounts.documents}
          </span>
        </button>

        <button
          onClick={() => setActiveCategory('music')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
            activeCategory === 'music'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <Music className="w-3.5 h-3.5 text-amber-500" />
          <span>Music</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200/50 dark:bg-slate-700 text-[10px]">
            {categoryCounts.music}
          </span>
        </button>

        <button
          onClick={() => setActiveCategory('folders')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
            activeCategory === 'folders'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <FolderIcon className="w-3.5 h-3.5 text-amber-500" />
          <span>Folders</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200/50 dark:bg-slate-700 text-[10px]">
            {categoryCounts.folders}
          </span>
        </button>
      </div>

      {/* ── Bulk Checklist Action Bar (Visible when items selected) ── */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-3 sm:px-4 flex items-center justify-between shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-extrabold flex items-center justify-center">
              {selectedIds.size}
            </span>
            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
              {selectedIds.size === 1 ? 'item selected' : 'items selected'}
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 underline ml-2"
            >
              Deselect
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkRestore}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-700 transition-all shadow-sm disabled:opacity-50"
            >
              {actionLoading === 'bulk' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>Restore ({selectedIds.size})</span>
            </button>

            <button
              onClick={handleBulkPurge}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-rose-200 dark:shadow-none disabled:opacity-50"
            >
              {actionLoading === 'bulk' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Delete Permanently</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Checklist Table ── */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-xs font-medium">Loading trash checklist...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 border-2 border-dashed border-slate-200 dark:border-slate-800 text-center max-w-lg mx-auto mt-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 flex items-center justify-center mx-auto mb-3">
            <Trash2 className="w-7 h-7" />
          </div>
          <h4 className="font-extrabold text-slate-700 dark:text-slate-200 text-base mb-1">
            No items in this category
          </h4>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {allItems.length === 0
              ? 'Your recycle bin is completely empty.'
              : 'There are no deleted items matching this category filter.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-[#FAFBFD] dark:bg-slate-800/60 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {/* Select All Checkbox */}
                <th className="py-3 px-4 w-10">
                  <button
                    onClick={handleSelectAll}
                    className="p-1 rounded text-slate-400 hover:text-indigo-600 transition-colors"
                    title={isAllSelected ? 'Deselect all' : 'Select all'}
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    ) : isPartiallySelected ? (
                      <MinusSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Deleted</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/80 text-xs">
              {filteredItems.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const isBusy = actionLoading === item.id;

                return (
                  <tr
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-indigo-400" />
                        )}
                      </div>
                    </td>

                    {/* Name & Icon */}
                    <td className="py-3 px-4 flex items-center space-x-3">
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 shrink-0">
                        {getCategoryIcon(item.category, item.type)}
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-xs sm:max-w-sm">
                        {item.name}
                      </span>
                    </td>

                    {/* Category Badge */}
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {item.type === 'folder' ? 'Folder' : item.category}
                      </span>
                    </td>

                    {/* Size */}
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-medium">
                      {item.size_bytes !== undefined ? formatBytes(item.size_bytes) : '—'}
                    </td>

                    {/* Deleted Date */}
                    <td className="py-3 px-4 text-slate-400 dark:text-slate-500">
                      {item.deleted_at
                        ? new Date(item.deleted_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Recently'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div
                        className="flex items-center justify-end space-x-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleRestore(item.id, item.type, item.name)}
                          disabled={isBusy}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">Restore</span>
                        </button>
                        <button
                          onClick={() => handlePurge(item.id, item.type, item.name)}
                          disabled={isBusy}
                          className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Purge</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
