import React from 'react';
import { Folder as FolderIcon, MoreHorizontal } from 'lucide-react';
import { Folder } from '../../types';

interface FolderCardProps {
  folder: Folder;
  onClick?: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export const FolderCard: React.FC<FolderCardProps> = ({ folder, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-5 border border-slate-100 hover:shadow-lg hover:shadow-slate-200/60 hover:border-slate-200 transition-all duration-300 cursor-pointer group relative overflow-hidden"
    >
      {/* Subtle colored accent at top */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl opacity-80"
        style={{ backgroundColor: folder.color }}
      />

      <div className="flex items-start justify-between mb-5 pt-1">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: `${folder.color}12`, color: folder.color }}
        >
          <FolderIcon className="w-6 h-6 fill-current" />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="p-1.5 text-slate-300 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div>
        <h4 className="font-bold text-slate-800 text-sm mb-1.5 truncate group-hover:text-slate-900 transition-colors">
          {folder.name}
        </h4>
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>{folder.files_count ?? 0} files</span>
          <span>{folder.total_size_bytes ? formatSize(folder.total_size_bytes) : '—'}</span>
        </div>
      </div>
    </div>
  );
};
