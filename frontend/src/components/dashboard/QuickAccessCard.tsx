import React from 'react';
import { Image, Video, FileText, File } from 'lucide-react';
import { FileItem } from '../../types';

interface QuickAccessCardProps {
  file: FileItem;
  previewUrl?: string;
  onClick?: () => void;
}

export const QuickAccessCard: React.FC<QuickAccessCardProps> = ({
  file,
  previewUrl,
  onClick,
}) => {
  const getIconAndColor = () => {
    if (file.mime_type.includes('image')) {
      return { icon: Image, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50' };
    }
    if (file.mime_type.includes('video')) {
      return { icon: Video, color: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50' };
    }
    if (file.mime_type.includes('pdf')) {
      return { icon: FileText, color: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/50' };
    }
    return { icon: File, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' };
  };

  const { icon: Icon, color, bg } = getIconAndColor();

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-950/50 hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-300 cursor-pointer group flex flex-col"
    >
      {/* Thumbnail area */}
      <div className="h-36 w-full rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-850 flex items-center justify-center relative mb-3">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={file.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
          />
        ) : (
          <div className={`p-4 rounded-2xl ${bg} ${color}`}>
            <Icon className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* File label */}
      <div className="flex items-center gap-2 px-1.5 pb-1">
        <div className={`p-1 rounded-md ${bg}`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
          {file.name}
        </span>
      </div>
    </div>
  );
};
