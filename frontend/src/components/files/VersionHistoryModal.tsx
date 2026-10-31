import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  History,
  Download,
  RotateCcw,
  UploadCloud,
  CheckCircle2,
  Clock,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { FileItem } from '../../types';
import { versionService, FileVersionItem } from '../../services/versions';

interface VersionHistoryModalProps {
  isOpen: boolean;
  file: FileItem | null;
  onClose: () => void;
  onVersionUpdated?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  file,
  onClose,
  onVersionUpdated,
}) => {
  const [versions, setVersions] = useState<FileVersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadVersions = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const data = await versionService.getFileVersions(file.id);
      setVersions(data);
    } catch (err) {
      console.error('Failed to load versions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && file) {
      loadVersions();
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const handleUploadNewVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      await versionService.uploadNewVersion(file.id, selected, (pct) => {
        setUploadProgress(pct);
      });
      await loadVersions();
      onVersionUpdated?.();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to upload new version.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRestore = async (versionNum: number) => {
    if (
      !confirm(
        `Are you sure you want to revert "${file.name}" to Version ${versionNum}?`
      )
    )
      return;

    setActionLoading(versionNum);
    try {
      await versionService.restoreFileVersion(file.id, versionNum);
      await loadVersions();
      onVersionUpdated?.();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to restore version.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async (versionNum: number) => {
    try {
      await versionService.downloadFileVersion(file.id, versionNum, file.name);
    } catch (err) {
      alert('Failed to download this version.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl p-6 sm:p-7 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800 truncate max-w-sm sm:max-w-md">
                Version History
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-sm">
                {file.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Upload New Version Bar */}
        <div className="pt-4 pb-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadNewVersion}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 text-xs font-bold rounded-xl transition-all border border-indigo-200/60"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            ) : (
              <UploadCloud className="w-4 h-4 text-indigo-600" />
            )}
            <span>
              {uploading
                ? `Uploading New Version (${uploadProgress}%)...`
                : 'Upload New Version (Revision)'}
            </span>
          </button>
        </div>

        {/* Versions List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin py-3 space-y-3 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
              <p className="text-xs font-medium">Loading version history...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No version history found.
            </div>
          ) : (
            versions.map((ver) => {
              const isCurrent = ver.version_number === file.current_version;
              const isActionLoading = actionLoading === ver.version_number;

              return (
                <div
                  key={ver.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-indigo-50/50 border-indigo-200/80 shadow-sm'
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isCurrent
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <span className="text-xs font-extrabold">
                        v{ver.version_number}
                      </span>
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-800">
                          Version {ver.version_number}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-[10px] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Current
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(ver.created_at).toLocaleString()}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {formatBytes(ver.size_bytes)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleDownload(ver.version_number)}
                      title="Download this version"
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {!isCurrent && (
                      <button
                        onClick={() => handleRestore(ver.version_number)}
                        disabled={isActionLoading}
                        title="Revert to this version"
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-600 text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
                      >
                        {isActionLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
