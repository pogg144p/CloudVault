import React, { useState, useRef, useEffect } from 'react';
import { Search, UploadCloud, Bell, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  pageTitle?: string;
  onOpenAuth: () => void;
  onUploadClick: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle = 'Dashboard',
  onOpenAuth,
  onUploadClick,
  searchQuery,
  onSearchChange,
}) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 bg-white/80 px-6 shadow-sm backdrop-blur-md">
      {/* Left — Page title */}
      <h1 className="hidden shrink-0 text-lg font-semibold text-slate-800 md:block">
        {pageTitle}
      </h1>

      {/* Center — Search bar */}
      <div className="relative mx-auto w-full max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search files & folders…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition-shadow focus:border-indigo-400 focus:ring-2 focus:ring-indigo-600/20"
        />
      </div>

      {/* Right — Actions */}
      <div className="flex shrink-0 items-center gap-3">
        {/* Upload button */}
        <button
          onClick={onUploadClick}
          className="hidden items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 sm:inline-flex"
        >
          <UploadCloud className="h-4 w-4" />
          Upload
        </button>

        {/* Notification bell */}
        <button className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* User area */}
        {user ? (
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-semibold text-white transition-shadow hover:shadow-md"
            >
              {getInitials(user.full_name || user.email)}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-12 w-64 rounded-2xl border border-slate-100 bg-white p-4 shadow-lg">
                <div className="mb-3 border-b border-slate-100 pb-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {user.full_name}
                  </p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};


