import React, { useState } from 'react';
import { X, Share2, Copy, Check, Lock, Calendar, Shield, Link2, Eye, Download } from 'lucide-react';
import { shareService, ShareResponse } from '../../services/shares';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: {
    id: string;
    name: string;
    type: 'file' | 'folder';
  } | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, target }) => {
  const [permission, setPermission] = useState<'view' | 'download'>('download');
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [usePassword, setUsePassword] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [createdShare, setCreatedShare] = useState<ShareResponse | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !target) return null;

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let expires_at: string | undefined = undefined;
      if (expiryDays > 0) {
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + expiryDays);
        expires_at = expDate.toISOString();
      }

      const res = await shareService.createShare({
        file_id: target.type === 'file' ? target.id : undefined,
        folder_id: target.type === 'folder' ? target.id : undefined,
        permission,
        password: usePassword && password.trim() ? password.trim() : undefined,
        expires_at,
      });

      setCreatedShare(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate share link.');
    } finally {
      setLoading(false);
    }
  };

  const getShareUrl = (token: string) => {
    return `${window.location.origin}?share=${token}`;
  };

  const handleCopy = () => {
    if (!createdShare) return;
    const url = getShareUrl(createdShare.share_token);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                Share {target.type === 'file' ? 'File' : 'Folder'}
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-xs">{target.name}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setCreatedShare(null);
              setError(null);
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600">
            {error}
          </div>
        )}

        {createdShare ? (
          <div className="py-6 space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center space-x-3 text-emerald-800">
              <Shield className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold block">Share Link Active!</span>
                <span>
                  Anyone with this link can {createdShare.permission === 'view' ? 'view' : 'download'} this {target.type}.
                  {createdShare.has_password && ' (Password protected)'}
                </span>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                readOnly
                value={getShareUrl(createdShare.share_token)}
                className="w-full pl-4 pr-28 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-700 select-all"
              />
              <button
                onClick={handleCopy}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCreatedShare(null)}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                Configure another link
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateShare} className="py-4 space-y-4">
            {/* Permission Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Access Permission
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPermission('download')}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-start space-x-2.5 ${
                    permission === 'download'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Download className={`w-4 h-4 mt-0.5 ${permission === 'download' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Can Download</span>
                    <span className="text-[10px] text-slate-400">View & download file</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPermission('view')}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-start space-x-2.5 ${
                    permission === 'view'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Eye className={`w-4 h-4 mt-0.5 ${permission === 'view' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Can View Only</span>
                    <span className="text-[10px] text-slate-400">Read-only preview</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Expiry Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Link Expiration</span>
              </label>
              <select
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value={1}>Expires in 24 hours</option>
                <option value={7}>Expires in 7 days</option>
                <option value={30}>Expires in 30 days</option>
                <option value={0}>Never expires</option>
              </select>
            </div>

            {/* Password Protection Toggle */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Password Protection</span>
                </label>
                <input
                  type="checkbox"
                  checked={usePassword}
                  onChange={(e) => setUsePassword(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              {usePassword && (
                <input
                  type="password"
                  placeholder="Set secret password for link"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required={usePassword}
                />
              )}
            </div>

            <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center space-x-1.5"
              >
                <Link2 className="w-4 h-4" />
                <span>{loading ? 'Creating...' : 'Create Share Link'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
