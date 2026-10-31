import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Folder as FolderIcon,
  ArrowRight,
  ExternalLink,
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
  const getFileIcon = (index: number, mime: string) => {
    const colors = [
      { bg: 'bg-indigo-50', text: 'text-indigo-500' },
      { bg: 'bg-rose-50', text: 'text-rose-500' },
      { bg: 'bg-amber-50', text: 'text-amber-500' },
      { bg: 'bg-emerald-50', text: 'text-emerald-500' },
      { bg: 'bg-violet-50', text: 'text-violet-500' },
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

  const defaultFiles = files.length > 0 ? files : [
    { id: '1', name: 'Building Image.jpeg', mime_type: 'image/jpeg', size_bytes: 12 * 1024 * 1024, created_at: '10 Oct, 10:23pm' },
    { id: '2', name: 'Product Design.fig', mime_type: 'application/octet-stream', size_bytes: 8 * 1024 * 1024, created_at: '10 Oct, 10:23pm' },
    { id: '3', name: 'Quarterly Report.pdf', mime_type: 'application/pdf', size_bytes: 4 * 1024 * 1024, created_at: '10 Oct, 10:23pm' },
    { id: '4', name: 'Presentation.pptx', mime_type: 'application/vnd.ms-powerpoint', size_bytes: 16 * 1024 * 1024, created_at: '10 Oct, 10:23pm' },
    { id: '5', name: 'Team Photo.png', mime_type: 'image/png', size_bytes: 6 * 1024 * 1024, created_at: '10 Oct, 10:23pm' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
      {/* Recently Uploaded Column — wider */}
      <div className="lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-slate-800 text-base">Recently Uploaded</h3>
          <button
            onClick={onOpenFileManager}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
          >
            View All <ExternalLink className="w-3 h-3" />
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
          {defaultFiles.map((file, idx) => (
            <div
              key={file.id + idx}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/80 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {getFileIcon(idx, file.mime_type)}
                <div className="truncate">
                  <h5 className="text-xs font-bold text-slate-800 truncate">
                    {file.name}
                  </h5>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {typeof file.created_at === 'string' && file.created_at.length > 15
                      ? new Date(file.created_at).toLocaleDateString()
                      : file.created_at}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 shrink-0 ml-4">
                {(file.size_bytes / (1024 * 1024)).toFixed(0)} MB
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* File Manager Quick Card */}
      <div className="lg:col-span-2 bg-gradient-to-br from-indigo-50/80 to-violet-50/60 border border-indigo-100/60 rounded-2xl p-5">
        <h3 className="font-extrabold text-slate-800 text-base mb-4">Quick Access</h3>

        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {[
            { name: 'My Folder', icon: FolderIcon, color: 'text-indigo-500', bg: 'bg-indigo-50' },
            { name: 'Documents', icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { name: 'Projects', icon: FolderIcon, color: 'text-amber-500', bg: 'bg-amber-50' },
            { name: 'Reports', icon: FileText, color: 'text-rose-500', bg: 'bg-rose-50' },
          ].map((item) => (
            <div key={item.name} className="bg-white p-3 rounded-xl border border-slate-100 hover:shadow-sm transition-all cursor-pointer group">
              <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center mb-2`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <h6 className="text-[11px] font-bold text-slate-700 truncate group-hover:text-slate-900">{item.name}</h6>
            </div>
          ))}
        </div>

        <button
          onClick={onOpenFileManager}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-200"
        >
          <span>Open File Manager</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
