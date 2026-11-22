import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  FolderSync,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { FileCategoryType, getCategoryLabel } from '../../utils/fileClassifier';

export interface MismatchedFileItem {
  file: File;
  detectedCategory: FileCategoryType;
}

interface CategoryMismatchModalProps {
  isOpen: boolean;
  currentCategory: FileCategoryType;
  mismatchedFiles: MismatchedFileItem[];
  matchingCount: number;
  onAutoSort: () => void;
  onSkip: () => void;
  onCancel: () => void;
}

export const CategoryMismatchModal: React.FC<CategoryMismatchModalProps> = ({
  isOpen,
  currentCategory,
  mismatchedFiles,
  matchingCount,
  onAutoSort,
  onSkip,
  onCancel,
}) => {
  if (!isOpen || mismatchedFiles.length === 0) return null;

  const currentLabel = getCategoryLabel(currentCategory);

  const getCategoryIcon = (cat: FileCategoryType) => {
    switch (cat) {
      case 'pictures':
        return <ImageIcon className="w-4 h-4 text-emerald-500" />;
      case 'videos':
        return <Video className="w-4 h-4 text-purple-500" />;
      case 'music':
        return <Music className="w-4 h-4 text-amber-500" />;
      case 'documents':
      default:
        return <FileText className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 w-full max-w-lg shadow-2xl space-y-5">
        {/* Header with warning icon */}
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
              Category Mismatch Detected
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              You are currently uploading inside the <span className="font-bold text-slate-700 dark:text-slate-200">{currentLabel}</span> section, but {mismatchedFiles.length === 1 ? 'this file does' : 'these files do'} not belong here.
            </p>
          </div>
        </div>

        {/* Mismatched file list */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {mismatchedFiles.map(({ file, detectedCategory }, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs"
            >
              <div className="p-2 rounded-xl bg-white dark:bg-slate-700 shadow-xs shrink-0">
                {getCategoryIcon(detectedCategory)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                <p className="text-[10px] text-slate-400">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] shrink-0">
                <span>Belongs in:</span>
                <span className="font-bold">{getCategoryLabel(detectedCategory)}</span>
              </div>
            </div>
          ))}
        </div>

        {matchingCount > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Note: {matchingCount} other file{matchingCount > 1 ? 's' : ''} matched the {currentLabel} category and will upload normally.
          </p>
        )}

        {/* Action Buttons as requested by user */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          {/* Cancel button */}
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors order-3 sm:order-1"
          >
            Cancel
          </button>

          {/* Red Box Button: Skip this file */}
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-md border border-rose-500 transition-all flex items-center justify-center gap-2 order-2 sm:order-2"
            title="Skip uploading the mismatched file(s)"
          >
            <XCircle className="w-4 h-4" />
            <span>Skip this file</span>
          </button>

          {/* Green Button: Auto-Sort (Place the file in designated area) */}
          <button
            type="button"
            onClick={onAutoSort}
            className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md border border-emerald-500 transition-all flex items-center justify-center gap-2 order-1 sm:order-3"
            title="Automatically place and upload into the designated category folder"
          >
            <FolderSync className="w-4 h-4" />
            <span>Auto-Sort</span>
          </button>
        </div>
      </div>
    </div>
  );
};
