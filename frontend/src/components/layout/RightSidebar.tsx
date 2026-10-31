import React from 'react';
import { Share2, Sparkles, Folder } from 'lucide-react';
import { MonthlyStat } from '../../types';

interface RightSidebarProps {
  monthlyStats?: MonthlyStat[];
}

export const RightSidebar: React.FC<RightSidebarProps> = () => {
  // Chart heights matching the reference visual style
  const barData = [
    { month: 'JAN', height: '35%', color: 'bg-indigo-600' },
    { month: 'FEB', height: '60%', color: 'bg-indigo-500' },
    { month: 'MAR', height: '85%', color: 'bg-cyan-400' },
    { month: 'APR', height: '95%', color: 'bg-cyan-300' },
    { month: 'MAY', height: '70%', color: 'bg-indigo-700' },
    { month: 'JUN', height: '45%', color: 'bg-indigo-600' },
  ];

  const sharedFolders = [
    { name: 'Sketch Files', email: 'mike@getnextdesign.com', time: '10 oct, 10:23pm' },
    { name: 'AutoCAD Drawings', email: 'shakir@gmail.com', time: '10 oct, 10:23pm' },
    { name: 'Master Spreadsheets', email: 'john@google.com', time: '10 oct, 10:23pm' },
    { name: 'Design Comps', email: 'kelvin@hunter.com', time: '10 oct, 10:23pm' },
    { name: 'Final Revisions', email: 'saim@purepixel.com', time: '10 oct, 10:23pm' },
  ];

  return (
    <aside className="w-80 bg-white border-l border-slate-100 p-6 flex flex-col justify-between shrink-0 h-screen overflow-y-auto">
      <div>
        {/* Usage Stats Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-extrabold text-slate-800 text-base">Usage Stats</h4>
          </div>

          {/* Minimalist Bar Chart */}
          <div className="h-32 flex items-end justify-between px-2 pt-4 pb-2 border-b border-slate-50">
            {barData.map((bar, i) => (
              <div key={i} className="flex flex-col items-center space-y-2 group">
                <div className="w-3.5 bg-slate-100 rounded-full h-24 flex items-end overflow-hidden">
                  <div
                    className={`w-full ${bar.color} rounded-full transition-all duration-500 group-hover:brightness-110`}
                    style={{ height: bar.height }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400">{bar.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Shared Folders Section */}
        <div className="mb-6">
          <h4 className="font-extrabold text-slate-800 text-base mb-4">Shared Folders</h4>
          <div className="space-y-3.5">
            {sharedFolders.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center space-x-3 p-2 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                  <Share2 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h6 className="text-xs font-bold text-slate-800 truncate">
                    {item.name}
                  </h6>
                  <p className="text-[10px] text-slate-400 truncate">
                    Shared with: {item.email}
                  </p>
                </div>
                <span className="text-[9px] text-slate-300 shrink-0">
                  {item.time.split(',')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Promotional / Referral Card */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-800 p-5 text-white shadow-lg shadow-indigo-100 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center space-x-1.5 text-indigo-200 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Bonus Storage</span>
          </div>
          <p className="text-xs font-bold leading-relaxed mb-4 text-white">
            Invite 2 friends and get <span className="underline decoration-indigo-300">5 GB extra space</span>.
          </p>
          <button className="py-2 px-4 bg-white text-indigo-700 hover:bg-indigo-50 font-extrabold text-xs rounded-xl shadow-sm transition-all duration-200">
            Invite Now!
          </button>
        </div>
        {/* Decorative background circle */}
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
      </div>
    </aside>
  );
};
