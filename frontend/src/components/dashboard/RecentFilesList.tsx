import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Folder as FolderIcon,
  ArrowRight,
  ExternalLink,
  UploadCloud,
  Heart,
  Trash2,
  Share2,
} from 'lucide-react';
import { FileItem } from '../../types';

interface RecentFilesListProps {
  files: FileItem[];
  onOpenFileManager: () => void;
}

export const RecentFilesList: React.FC<RecentFilesListProps> = ({
  files,
  onOpenFileManager,
}) => {
  const getFileIcon = (index: number, mime: string = '') => {
    const colors = [
      { bg: 'bg-indigo-50 dark:bg-indigo-950/50', text: 'text-indigo-500 dark:text-indigo-400' },
      { bg: 'bg-rose-50 dark:bg-rose-950/50', text: 'text-rose-500 dark:text-rose-400' },
      { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-500 dark:text-amber-400' },
      { bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-500 dark:text-emerald-400' },
      { bg: 'bg-violet-50 dark:bg-violet-950/50', text: 'text-violet-500 dark:text-violet-400' },
    ];
    const c = colors[index % colors.length];

    let IconComp = FileText;
    if (mime.includes('image')) IconComp = ImageIcon;
    else if (mime.includes('video')) IconComp = Video;
    else if (mime.includes('audio')) IconComp = Music;

    return (
      <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
        <IconComp className={`w-4 h-4 ${c.text}`} />
      </div>
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
      {/* Recently Uploaded Column — wider */}
      <div className="lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">Recently Uploaded</h3>
          {files.length > 0 && (
            <button
              onClick={onOpenFileManager}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              View All <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>

        {files.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-8 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 dark:text-indigo-400 flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
              Your recently uploaded files will appear here
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mb-4">
              Upload documents, pictures, or videos to start managing your secure cloud storage.
            </p>
            <button
              onClick={onOpenFileManager}
              className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl transition-colors"
            >
              Upload a File
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/80 overflow-hidden">
            {files.map((file, idx) => (
              <div
                key={file.id + idx}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getFileIcon(idx, file.mime_type)}
                  <div className="truncate">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {file.name}
                    </h5>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      {typeof file.created_at === 'string' && file.created_at.length > 15
                        ? new Date(file.created_at).toLocaleDateString()
                        : file.created_at}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 shrink-0 ml-4">
                  {formatFileSize(file.size_bytes)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File Manager Quick Card */}
      <div className="lg:col-span-2 bg-gradient-to-br from-indigo-50/80 to-violet-50/60 dark:from-slate-900 dark:to-indigo-950/40 border border-indigo-100/60 dark:border-slate-800 rounded-2xl p-5">
        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base mb-4">Quick Navigation</h3>

        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {[
            { name: 'All Files', icon: FolderIcon, color: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/50' },
            { name: 'Favorites', icon: Heart, color: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50' },
            { name: 'Shared', icon: Share2, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50' },
            { name: 'Trash', icon: Trash2, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
          ].map((item) => (
            <div
              key={item.name}
              onClick={onOpenFileManager}
              className="bg-white dark:bg-slate-800/90 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center mb-2`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <h6 className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white">
                {item.name}
              </h6>
            </div>
          ))}
        </div>

        <button
          onClick={onOpenFileManager}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-200 dark:shadow-none"
        >
          <span>Open File Manager</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
