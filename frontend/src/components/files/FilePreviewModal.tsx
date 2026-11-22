import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  FileText,
  FileQuestion,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  AlertCircle,
  Star,
} from 'lucide-react';
import { FileItem } from '../../types';
import { fileService } from '../../services/files';
import api, { getFilePreviewUrl } from '../../services/api';

interface FilePreviewModalProps {
  isOpen: boolean;
  file: FileItem | null;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  file,
  onClose,
}) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFavorite, setIsFavorite] = useState(file?.is_favorite ?? false);

  useEffect(() => {
    setIsFavorite(file?.is_favorite ?? false);
  }, [file]);

  const handleToggleFavorite = async () => {
    if (!file) return;
    try {
      const next = !isFavorite;
      setIsFavorite(next);
      await fileService.toggleFavorite(file.id, isFavorite);
    } catch (err) {
      setIsFavorite(isFavorite);
    }
  };

  useEffect(() => {
    let activeBlobUrl: string | null = null;
    let isCancelled = false;

    if (!isOpen || !file) {
      setTextContent(null);
      setBlobUrl(null);
      setPreviewError(null);
      setLoading(false);
      return;
    }

    const mime = file.mime_type.toLowerCase();
    const isText =
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('javascript') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.py') ||
      file.name.endsWith('.json') ||
      file.name.endsWith('.csv') ||
      file.name.endsWith('.ts') ||
      file.name.endsWith('.tsx') ||
      file.name.endsWith('.yaml') ||
      file.name.endsWith('.yml') ||
      file.name.endsWith('.sql');

    const isImage = mime.startsWith('image/');
    const isPdf = mime === 'application/pdf' || file.name.endsWith('.pdf');
    const isVideo = mime.startsWith('video/');
    const isAudio = mime.startsWith('audio/');

    setLoading(true);
    setPreviewError(null);
    setTextContent(null);
    setBlobUrl(null);

    if (isText) {
      api
        .get(`/files/${file.id}/preview`, { responseType: 'text' })
        .then((res) => {
          if (isCancelled) return;
          setTextContent(
            typeof res.data === 'string'
              ? res.data
              : JSON.stringify(res.data, null, 2)
          );
        })
        .catch((err) => {
          if (isCancelled) return;
          console.error('Failed to load text preview:', err);
          setPreviewError('Failed to load text preview.');
        })
        .finally(() => {
          if (!isCancelled) setLoading(false);
        });
    } else if (isImage || isPdf) {
      // Fetch authenticated blob for direct browser rendering
      api
        .get(`/files/${file.id}/preview`, { responseType: 'blob' })
        .then((res) => {
          if (isCancelled) return;
          const contentType = (res.headers && res.headers['content-type']) ? String(res.headers['content-type']) : undefined;
          const blob = new Blob([res.data], {
            type: file.mime_type || contentType || 'application/octet-stream',
          });
          const url = URL.createObjectURL(blob);
          activeBlobUrl = url;
          setBlobUrl(url);
        })
        .catch((err) => {
          if (isCancelled) return;
          console.error('Failed to load file preview blob:', err);
          setPreviewError('Unable to load preview for this file.');
        })
        .finally(() => {
          if (!isCancelled) setLoading(false);
        });
    } else if (isVideo || isAudio) {
      // Audio and video stream best with authenticated URL
      setBlobUrl(getFilePreviewUrl(file.id));
      setLoading(false);
    } else {
      setLoading(false);
    }

    return () => {
      isCancelled = true;
      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
      }
    };
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const mime = file.mime_type.toLowerCase();
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf' || file.name.endsWith('.pdf');
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/');
  const isText =
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('javascript') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.md') ||
    file.name.endsWith('.py') ||
    file.name.endsWith('.json') ||
    file.name.endsWith('.csv') ||
    file.name.endsWith('.ts') ||
    file.name.endsWith('.tsx') ||
    file.name.endsWith('.yaml') ||
    file.name.endsWith('.yml') ||
    file.name.endsWith('.sql');

  const externalPreviewUrl = getFilePreviewUrl(file.id);

  const handleDownload = () => {
    fileService.downloadFile(file.id, file.name);
  };

  const handleCopyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
        {/* Header */}
        <div className="h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate max-w-sm sm:max-w-md">
                  {file.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-[10px]">
                  v{file.current_version}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                {formatBytes(file.size_bytes)} • {file.mime_type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Favorite */}
            <button
              onClick={handleToggleFavorite}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isFavorite
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-500 hover:bg-amber-100'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span className="hidden sm:inline">{isFavorite ? 'Favorited' : 'Favorite'}</span>
            </button>

            {isText && textContent && (
              <button
                onClick={handleCopyText}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
                title="Copy text content"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            )}

            {/* Open raw preview in new tab */}
            <a
              href={externalPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
              title="Open full view in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full View</span>
            </a>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-indigo-100 dark:shadow-none"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              aria-label="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Viewer Body */}
        <div className="flex-1 bg-slate-50 dark:bg-slate-950/70 relative flex items-center justify-center overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-3" />
              <p className="text-xs font-semibold">Loading file preview...</p>
            </div>
          ) : previewError ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 text-center max-w-md">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-base mb-1">
                Preview Unavailable
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
                {previewError}
              </p>
              <button
                onClick={handleDownload}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-100 dark:shadow-none"
              >
                <Download className="w-4 h-4" />
                <span>Download File ({formatBytes(file.size_bytes)})</span>
              </button>
            </div>
          ) : isImage && blobUrl ? (
            /* 1. Image Viewer */
            <div className="w-full h-full flex items-center justify-center p-2">
              <img
                src={blobUrl}
                alt={file.name}
                className="max-h-full max-w-full object-contain rounded-2xl shadow-md transition-transform"
              />
            </div>
          ) : isPdf && blobUrl ? (
            /* 2. PDF Viewer */
            <iframe
              src={blobUrl}
              title={file.name}
              className="w-full h-full rounded-2xl bg-white shadow-inner border border-slate-200 dark:border-slate-800"
            />
          ) : isVideo && blobUrl ? (
            /* 3. Video Player */
            <video
              controls
              autoPlay={false}
              src={blobUrl}
              className="max-h-full max-w-full rounded-2xl shadow-lg bg-black"
            >
              Your browser does not support the video tag.
            </video>
          ) : isAudio && blobUrl ? (
            /* 4. Audio Player */
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col items-center max-w-md w-full">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm mb-4 text-center truncate w-full">
                {file.name}
              </h4>
              <audio controls src={blobUrl} className="w-full" />
            </div>
          ) : isText && textContent !== null ? (
            /* 5. Code / Text Viewer */
            <pre className="w-full h-full bg-slate-950 text-slate-100 p-6 rounded-2xl font-mono text-xs overflow-auto shadow-inner border border-slate-800 whitespace-pre-wrap leading-relaxed select-text">
              {textContent}
            </pre>
          ) : (
            /* 6. Fallback Unsupported Viewer */
            <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 text-center max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
                <FileQuestion className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-base mb-1">
                Preview Not Available
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
                This file format ({file.mime_type}) cannot be previewed directly in the browser. You can download it to view it locally.
              </p>
              <button
                onClick={handleDownload}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-100 dark:shadow-none"
              >
                <Download className="w-4 h-4" />
                <span>Download File ({formatBytes(file.size_bytes)})</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
