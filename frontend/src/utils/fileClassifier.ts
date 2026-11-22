export type FileCategoryType = 'pictures' | 'videos' | 'documents' | 'music';

export interface CategoryInfo {
  id: FileCategoryType;
  label: string;
  folderName: string;
}

export const CATEGORY_MAP: Record<FileCategoryType, CategoryInfo> = {
  pictures: { id: 'pictures', label: 'Images', folderName: 'Images' },
  videos: { id: 'videos', label: 'Videos', folderName: 'Videos' },
  documents: { id: 'documents', label: 'Documents', folderName: 'Documents' },
  music: { id: 'music', label: 'Music & Audio', folderName: 'Music' },
};

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.heic', '.raw'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.flv', '.wmv', '.m4v', '.3gp'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.wma', '.opus', '.aiff'];
const DOC_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.txt', '.csv', '.xls', '.xlsx', '.ppt', '.pptx',
  '.json', '.md', '.xml', '.html', '.css', '.js', '.ts', '.tsx', '.py', '.rtf', '.log', '.sql', '.yaml', '.yml'
];

/**
 * Classifies a file by extension and MIME type into one of: 'pictures' | 'videos' | 'documents' | 'music'
 */
export function classifyFile(filename: string, mimeType: string = ''): FileCategoryType {
  const lowerName = filename.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  // 1. MIME type inspection
  if (lowerMime.startsWith('image/')) return 'pictures';
  if (lowerMime.startsWith('video/')) return 'videos';
  if (lowerMime.startsWith('audio/')) return 'music';
  if (
    lowerMime.startsWith('text/') ||
    lowerMime.includes('pdf') ||
    lowerMime.includes('document') ||
    lowerMime.includes('sheet') ||
    lowerMime.includes('presentation') ||
    lowerMime.includes('json') ||
    lowerMime.includes('msword') ||
    lowerMime.includes('officedocument')
  ) {
    return 'documents';
  }

  // 2. Extension fallback
  if (IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) return 'pictures';
  if (VIDEO_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) return 'videos';
  if (AUDIO_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) return 'music';
  if (DOC_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) return 'documents';

  // Default fallback
  return 'documents';
}

/**
 * Returns user-friendly name for a category id
 */
export function getCategoryLabel(category: FileCategoryType): string {
  return CATEGORY_MAP[category]?.label || 'Documents';
}
