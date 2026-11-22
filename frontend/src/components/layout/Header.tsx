import React from 'react';
import { Search, UploadCloud, Sun, Moon, Command } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface HeaderProps {
  pageTitle?: string;
  onOpenAuth: () => void;
  onUploadClick: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenGlobalSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle = 'Dashboard',
  onUploadClick,
  searchQuery,
  onSearchChange,
  onOpenGlobalSearch,
}) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 bg-white/80 dark:bg-slate-900/80 px-6 shadow-sm backdrop-blur-md border-b border-slate-100 dark:border-slate-800 transition-colors">
      {/* Left — Page title */}
      <h1 className="hidden shrink-0 text-lg font-bold text-slate-800 dark:text-slate-100 md:block">
        {pageTitle}
      </h1>

      {/* Center — Interactive Search bar */}
      <div className="relative mx-auto w-full max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder="Search files, documents, media... (Press / to search)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
              e.preventDefault();
              onOpenGlobalSearch?.();
            }
          }}
          className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 pl-10 pr-24 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20"
        />

        {/* Global Search shortcut button */}
        {onOpenGlobalSearch && (
          <button
            type="button"
            onClick={onOpenGlobalSearch}
            title="Open Deep Search (Ctrl + K)"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-400 dark:text-slate-400 bg-white dark:bg-slate-700/70 border border-slate-200 dark:border-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-xs"
          >
            <Command className="w-3 h-3" />
            <span>K</span>
          </button>
        )}
      </div>

      {/* Right — Actions */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Upload button */}
        <button
          onClick={onUploadClick}
          className="hidden items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition-colors sm:inline-flex shadow-sm shadow-indigo-200 dark:shadow-none"
        >
          <UploadCloud className="h-4 w-4" />
          Upload
        </button>

        {/* Theme Toggle (Night / Light Mode) */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Night Mode'}
          className="rounded-xl p-2 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
        >
          {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-600" />}
        </button>
      </div>
    </header>
  );
};
