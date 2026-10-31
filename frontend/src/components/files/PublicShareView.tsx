import React, { useEffect, useState } from 'react';
import {
  Cloud,
  Download,
  Lock,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  ShieldAlert,
  Loader2,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { PublicShareItem, shareService } from '../../services/shares';

interface PublicShareViewProps {
  shareToken: string;
  onExit: () => void;
}

export const PublicShareView: React.FC<PublicShareViewProps> = ({ shareToken, onExit }) => {
  const [data, setData] = useState<PublicShareItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShareInfo = async (pw?: string) => {
    setLoading(true);
    setPasswordError(null);
    setError(null);
    try {
      const res = await shareService.getPublicShare(shareToken, pw);
      setData(res);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setPasswordError('Incorrect password. Please try again.');
      } else if (err.response?.status === 410) {
        setError('This shared link has expired and is no longer accessible.');
      } else {
        setError(err.response?.data?.detail || 'This shared link is invalid or was revoked.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShareInfo();
  }, [shareToken]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    await fetchShareInfo(password.trim());
  };

  const handleDownload = async () => {
    if (!data || !data.item_name) return;
    setDownloading(true);
    try {
      await shareService.downloadPublicSharedFile(shareToken, data.item_name, password || undefined);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Download failed.');
    } finally {
      setDownloading(false);
    }
  };

  const getFileIcon = (mime?: string | null) => {
    if (!mime) return <FileText className="w-12 h-12 text-slate-400" />;
    if (mime.includes('image')) return <ImageIcon className="w-12 h-12 text-emerald-500" />;
    if (mime.includes('video')) return <Video className="w-12 h-12 text-rose-500" />;
    if (mime.includes('audio')) return <Music className="w-12 h-12 text-amber-500" />;
    if (mime.includes('pdf')) return <FileText className="w-12 h-12 text-indigo-500" />;
    return <FileText className="w-12 h-12 text-slate-400" />;
  };

  const formatSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] to-[#EEF2F6] flex flex-col items-center justify-center p-4">
      {/* Brand Header */}
      <div className="flex items-center space-x-2.5 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-100">
          <Cloud className="w-6 h-6" />
        </div>
        <div>
          <span className="font-extrabold text-lg tracking-wide text-slate-900 block leading-none">
            MY CLOUD
          </span>
          <span className="text-[10px] tracking-widest text-indigo-500 font-bold uppercase">
            CloudVault Secure Sharing
          </span>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center relative overflow-hidden">
        {loading ? (
          <div className="py-12 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
            <p className="text-xs font-semibold text-slate-500">Checking secure link...</p>
          </div>
        ) : error ? (
          <div className="py-8">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-800 mb-2">Link Inaccessible</h3>
            <p className="text-xs text-slate-500 mb-6">{error}</p>
            <button
              onClick={onExit}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              Go to CloudVault
            </button>
          </div>
        ) : data?.requires_password ? (
          <div className="py-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-800 mb-1">Password Protected</h3>
            <p className="text-xs text-slate-400 mb-6">
              The owner has protected this shared item with a password.
            </p>

            {passwordError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleUnlock} className="space-y-4">
              <input
                type="password"
                required
                placeholder="Enter password to access"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-medium"
                autoFocus
              />
              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center space-x-2"
              >
                <span>Unlock File</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="py-2">
            {/* File Icon */}
            <div className="w-20 h-20 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
              {getFileIcon(data?.item_mime_type)}
            </div>

            <h3 className="text-lg font-extrabold text-slate-800 truncate mb-1">
              {data?.item_name}
            </h3>

            <div className="flex items-center justify-center space-x-2 text-xs text-slate-400 font-medium mb-6">
              <span>{formatSize(data?.item_size_bytes)}</span>
              <span>•</span>
              <span className="capitalize">{data?.item_type}</span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">
                {data?.permission === 'view' ? 'View Only' : 'Download Allowed'}
              </span>
            </div>

            {data?.permission === 'view' ? (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-500 flex items-center justify-center space-x-2">
                <Eye className="w-4 h-4 text-slate-400" />
                <span>This item is view-only. Direct downloads are restricted by the owner.</span>
              </div>
            ) : (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-2xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center space-x-2"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{downloading ? 'Downloading...' : 'Download File'}</span>
              </button>
            )}

            <div className="mt-8 pt-4 border-t border-slate-100">
              <button
                onClick={onExit}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Back to CloudVault Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
