import React, { useState } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Share2,
  Heart,
  Clock,
  Image as ImageIcon,
  Video,
  FileText,
  Trash2,
  Music,
  Cloud,
  HardDrive,
  ChevronRight,
  Settings,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ProfileSettingsModal } from '../settings/ProfileSettingsModal';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

const NAV_SECTIONS = [
  {
    title: 'Menu',
    adminOnly: false,
    items: [
      { id: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
      { id: 'all_files',  label: 'All Files',   icon: FolderOpen },
      { id: 'recent',     label: 'Recent',      icon: Clock },
      { id: 'favorites',  label: 'Favorites',   icon: Heart },
      { id: 'shared',     label: 'Shared',      icon: Share2 },
      { id: 'trash',      label: 'Trash',       icon: Trash2 },
    ],
  },
  {
    title: 'Categories',
    adminOnly: false,
    items: [
      { id: 'pictures',   label: 'Images',      icon: ImageIcon },
      { id: 'videos',     label: 'Videos',      icon: Video },
      { id: 'documents',  label: 'Documents',   icon: FileText },
      { id: 'music',      label: 'Music',       icon: Music },
    ],
  },
  {
    title: 'Operations',
    adminOnly: true,
    items: [
      { id: 'health',     label: 'System Health', icon: Activity },
    ],
  },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { user } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const used  = user?.storage_used_bytes  ?? 0;
  const quota = user?.storage_quota_bytes ?? 100 * 1024 * 1024;
  const pct   = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const free  = Math.max(0, quota - used);

  const barColor =
    pct >= 90 ? 'from-rose-500 to-red-400' :
    pct >= 70 ? 'from-amber-400 to-orange-400' :
                'from-indigo-500 to-violet-500';

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex flex-col h-screen shrink-0 select-none overflow-hidden transition-colors">
      {/* ── Brand ── */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200/50 dark:shadow-none">
          <Cloud className="w-5 h-5 text-white" />
        </div>
        <div className="leading-none">
          <span className="block text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">CloudVault</span>
          <span className="block text-[10px] text-indigo-500 font-semibold mt-0.5 tracking-wide">SECURE STORAGE</span>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="mx-5 border-t border-slate-100 dark:border-slate-800" />

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 pt-4 pb-4 space-y-6">
        {NAV_SECTIONS.filter(s => !s.adminOnly || user?.is_superuser).map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 px-3 mb-2">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map(({ id, label, icon: Icon }) => {
                const active = currentTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => onTabChange(id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold
                      transition-all duration-200 group relative
                      ${active
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }
                    `}
                  >
                    {/* Active indicator bar */}
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-indigo-600 rounded-r-full" />
                    )}
                    <span className={`p-1.5 rounded-lg transition-colors ${
                      active ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 text-left">{label}</span>
                    {active && <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Storage card ── */}
      <div className="px-4 pb-3">
        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/50 dark:from-slate-800/80 dark:to-indigo-950/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/60">
              <HardDrive className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Storage</span>
            <span className="ml-auto text-xs font-extrabold text-indigo-600 dark:text-indigo-400">{pct}%</span>
          </div>

          <div className="w-full h-2 bg-white dark:bg-slate-900 rounded-full overflow-hidden mb-2.5 shadow-inner">
            <div
              className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-700`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
            <span>{formatBytes(used)} used</span>
            <span>{formatBytes(free)} free</span>
          </div>
        </div>
      </div>

      {/* ── Settings link ── */}
      <div className="px-3 pb-4">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all"
        >
          <span className="p-1.5 rounded-lg bg-slate-100 text-slate-400">
            <Settings className="w-4 h-4" />
          </span>
          <span>Settings</span>
        </button>
      </div>

      <ProfileSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
};
