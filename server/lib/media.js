// File-type helpers shared by every source.

const VIDEO_TYPES = new Set(['mov', 'mp4', 'm4v', 'avi', 'mxf', 'webm', 'wmv']);
const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'tif', 'tiff', 'gif', 'webp', 'heic', 'bmp', 'eps', 'psd', 'ai', 'svg']);

// The extensions sent to the DAM when someone asks for only photos or only video.
export const DAM_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'tif'];
export const DAM_VIDEO_EXTENSIONS = ['mp4', 'mov'];

/** 'image', 'video' or 'other' for a file extension like "JPEG" or ".mov". */
export function mediaTypeFor(extension) {
  const ext = String(extension || '').toLowerCase().replace(/^\./, '');
  if (VIDEO_TYPES.has(ext)) return 'video';
  if (IMAGE_TYPES.has(ext)) return 'image';
  return 'other';
}

/**
 * Picks a small preview for a DAM thumbnail address.
 * Brandfolder's thumbs.bfldr.com previews are already small. Video frames on
 * assets.gettyimages.com are full size, so we ask the image server for a 262px
 * version (full-size frames froze Teams, and they slow a web page down too).
 */
export function smallPreview(url) {
  if (!url) return null;
  if (url.includes('assets.gettyimages.com') && !url.includes('Signature=') && !/[?&]width=/.test(url)) {
    return `${url}${url.includes('?') ? '&' : '?'}width=262`;
  }
  return url;
}
