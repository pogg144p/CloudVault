import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Folder as FolderIcon,
  Download,
  Eye,
  Star,
  ShieldCheck,
  Loader2,
  ArrowRight,
  Command,
} from 'lucide-react';
import { FileItem } from '../../types';
import { fileService } from '../../services/files';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToFolder: (folderId: string) => void;
  onPreviewFile?: (file: FileItem) => void;
}

type CategoryFilter = 'all' | 'documents' | 'pictures' | 'videos' | 'music' | 'favorites';

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigateToFolder,
  onPreviewFile,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [results, setResults] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      searchFiles(query, category);
    } else {
      setQuery('');
      setCategory('all');
      setResults([]);
    }
  }, [isOpen]);

  // Global keydown listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < results.length ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (onPreviewFile) {
          onPreviewFile(selected);
          onClose();
        } else if (selected.folder_id) {
          onNavigateToFolder(selected.folder_id);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      searchFiles(query, category);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, category, isOpen]);

  const searchFiles = async (q: string, cat: CategoryFilter) => {
    setLoading(true);
    try {
      const data = await fileService.listFiles({
        search: q.trim() || undefined,
        category: cat === 'all' || cat === 'favorites' ? undefined : cat,
        only_favorites: cat === 'favorites' ? true : undefined,
      });
      setResults(data);
      setSelectedIndex(0);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, file: FileItem) => {
    e.stopPropagation();
    try {
      setResults((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, is_favorite: !f.is_favorite } : f))
      );
      await fileService.toggleFavorite(file.id, file.is_favorite);
    } catch (err) {
      console.error('Failed to toggle favorite', err);
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-rose-500" />;
    if (mime.startsWith('video/')) return <Video className="w-4 h-4 text-purple-500" />;
    if (mime.startsWith('audio/')) return <Music className="w-4 h-4 text-amber-500" />;
    return <FileText className="w-4 h-4 text-indigo-500" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type file name, extension (.pdf, .png), or keyword..."
            className="flex-1 bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-base outline-none font-medium"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            ESC
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-none text-xs">
          {[
            { id: 'all', label: 'All Files' },
            { id: 'documents', label: 'Documents' },
            { id: 'pictures', label: 'Images' },
            { id: 'videos', label: 'Videos' },
            { id: 'music', label: 'Audio' },
            { id: 'favorites', label: '★ Favorites' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id as CategoryFilter)}
              className={`px-3 py-1 rounded-full font-semibold transition-all shrink-0 ${
                category === cat.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {query ? 'No matching files found' : 'Start typing to search your CloudVault'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Search across all directories, extensions, and media tags
              </p>
            </div>
          ) : (
            results.map((file, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={file.id}
                  onClick={() => {
                    if (onPreviewFile) {
                      onPreviewFile(file);
                      onClose();
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 shadow-xs'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  {/* File Icon */}
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    {getFileIcon(file.mime_type)}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                        {file.name}
                      </p>
                      {file.is_favorite && (
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span>{formatBytes(file.size_bytes)}</span>
                      <span>•</span>
                      <span>v{file.current_version}</span>
                      {file.checksum_sha256 && (
                        <>
                          <span>•</span>
                          <span
                            className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded"
                            title={`SHA-256: ${file.checksum_sha256}`}
                          >
                            <ShieldCheck className="w-3 h-3" />
                            SHA-256 Verified
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handleToggleFavorite(e, file)}
                      title={file.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                      className={`p-2 rounded-xl transition-colors ${
                        file.is_favorite
                          ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                          : 'text-slate-400 hover:text-amber-500 hover:bg-white dark:hover:bg-slate-800'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${file.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                    {onPreviewFile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewFile(file);
                          onClose();
                        }}
                        title="Preview File"
                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fileService.downloadFile(file.id, file.name);
                      }}
                      title="Download File"
                      className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {file.folder_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToFolder(file.folder_id!);
                          onClose();
                        }}
                        title="Go to Folder"
                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono text-[10px]">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono text-[10px]">
                ↓
              </kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono text-[10px]">
                ↵
              </kbd>
              to select / preview
            </span>
          </div>
          <span>{results.length} files found</span>
        </div>
      </div>
    </div>
  );
};
