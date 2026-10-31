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
} from 'lucide-react';
import { FileItem } from '../../types';
import { fileService } from '../../services/files';
import api from '../../services/api';

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
  const [textLoading, setTextLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !file) {
      setTextContent(null);
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
      file.name.endsWith('.csv');

    if (isText) {
      setTextLoading(true);
      api
        .get(`/files/${file.id}/preview`, { responseType: 'text' })
        .then((res) => {
          setTextContent(typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2));
        })
        .catch(() => {
          setTextContent('Failed to load text preview.');
        })
        .finally(() => {
          setTextLoading(false);
        });
    } else {
      setTextContent(null);
    }
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
    file.name.endsWith('.csv');

  const token = localStorage.getItem('cloudvault_access_token');
  const previewUrl = `/api/v1/files/${file.id}/preview`;

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
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="h-16 px-6 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-800 truncate max-w-sm sm:max-w-md">
                  {file.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[10px]">
                  v{file.current_version}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {formatBytes(file.size_bytes)} • {file.mime_type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isText && textContent && (
              <button
                onClick={handleCopyText}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                title="Copy text content"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            )}

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-indigo-100"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Viewer Body */}
        <div className="flex-1 bg-slate-900/5 relative flex items-center justify-center overflow-auto p-4">
          {/* 1. Image Viewer */}
          {isImage ? (
            <div className="w-full h-full flex items-center justify-center p-2">
              <img
                src={previewUrl}
                alt={file.name}
                className="max-h-full max-w-full object-contain rounded-2xl shadow-md transition-transform"
              />
            </div>
          ) : isPdf ? (
            /* 2. PDF Viewer */
            <iframe
              src={previewUrl}
              title={file.name}
              className="w-full h-full rounded-2xl bg-white shadow-inner border border-slate-200"
            />
          ) : isVideo ? (
            /* 3. Video Player */
            <video
              controls
              autoPlay={false}
              src={previewUrl}
              className="max-h-full max-w-full rounded-2xl shadow-lg bg-black"
            >
              Your browser does not support the video tag.
            </video>
          ) : isAudio ? (
            /* 4. Audio Player */
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center max-w-md w-full">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-slate-800 text-sm mb-4 text-center truncate w-full">
                {file.name}
              </h4>
              <audio controls src={previewUrl} className="w-full" />
            </div>
          ) : isText ? (
            /* 5. Code / Text Viewer */
            textLoading ? (
              <div className="flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                <p className="text-xs font-medium">Loading text content...</p>
              </div>
            ) : (
              <pre className="w-full h-full bg-slate-950 text-slate-100 p-6 rounded-2xl font-mono text-xs overflow-auto shadow-inner border border-slate-800 whitespace-pre-wrap leading-relaxed select-text">
                {textContent}
              </pre>
            )
          ) : (
            /* 6. Fallback Unsupported Viewer */
            <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 text-center max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                <FileQuestion className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-slate-800 text-base mb-1">
                Preview Not Available
              </h4>
              <p className="text-xs text-slate-400 mb-6">
                This file format ({file.mime_type}) cannot be previewed directly in the browser. You can download it to view it locally.
              </p>
              <button
                onClick={handleDownload}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-100"
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
