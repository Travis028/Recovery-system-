/**
 * Photograph safety checks, done before anything is uploaded.
 *
 * 1. Only real JPG or PNG files: the first bytes of the file (its "signature") are
 *    checked, not just the name or the browser-reported type.
 * 2. Size limit of 5 MB.
 * 3. The image is redrawn on a canvas and saved again as a new JPG. This removes all
 *    hidden photo data (EXIF: GPS location, phone model, time) and anything appended to
 *    the file, which also neutralises most disguised malicious files.
 * 4. Two fingerprints are computed for duplicate detection: an exact SHA-256 hash and a
 *    small "average hash" that stays the same when the same document is photographed again.
 *
 * Production: the server repeats these checks and scans every upload with an antivirus
 * engine (for example ClamAV) before storing it.
 */
import { sha256Hex } from '@/api/crypto';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 1600;

async function signature(file) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (isJpeg) return 'image/jpeg';
  if (isPng) return 'image/png';
  return null;
}

function loadImage(file) {
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error('The file could not be read as a photograph.'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(function (resolve) {
    canvas.toBlob(resolve, type, quality);
  });
}

/**
 * 64-bit average hash as a 16-character hex string. The image is split into an 8 x 8
 * grid; each cell's average brightness is compared with the overall average. Computed
 * from the full pixel data (not a browser downscale) so it is stable across devices.
 */
function averageHash(canvas) {
  const width = canvas.width;
  const height = canvas.height;
  const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  const sums = new Array(64).fill(0);
  const counts = new Array(64).fill(0);
  const step = Math.max(1, Math.floor(Math.min(width, height) / 256));
  for (let y = 0; y < height; y += step) {
    const row = Math.min(7, Math.floor((y * 8) / height));
    for (let x = 0; x < width; x += step) {
      const col = Math.min(7, Math.floor((x * 8) / width));
      const i = (y * width + x) * 4;
      sums[row * 8 + col] += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      counts[row * 8 + col] += 1;
    }
  }
  const cells = sums.map(function (sum, index) {
    return counts[index] ? sum / counts[index] : 0;
  });
  const mean = cells.reduce(function (a, b) { return a + b; }, 0) / 64;
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j += 1) nibble = (nibble << 1) | (cells[i + j] > mean ? 1 : 0);
    hex += nibble.toString(16);
  }
  return hex;
}

export function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}

/**
 * Validates and cleans a photograph. Returns { file, sha256, phash, width, height }
 * or throws an Error with a message for the user.
 */
export async function prepareDocumentPhoto(file) {
  if (!file) throw new Error('Choose a photograph first.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('That photograph is too large. Take a smaller picture below 5 MB.');
  const type = await signature(file);
  if (!type) throw new Error('Only JPG or PNG photographs can be uploaded.');

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
  if (!blob) throw new Error('The photograph could not be processed.');
  const clean = new File([blob], 'document.jpg', { type: 'image/jpeg' });
  const sha256 = await sha256Hex(new Uint8Array(await blob.arrayBuffer()));
  const phash = averageHash(canvas);

  return { file: clean, sha256, phash, width: canvas.width, height: canvas.height };
}

/** Grey-scale and contrast clean-up before OCR. The canvas is discarded afterwards. */
export async function cleanForOcr(file) {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = frame.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const stretched = Math.max(0, Math.min(255, (gray - 128) * 1.6 + 128));
    d[i] = d[i + 1] = d[i + 2] = stretched;
  }
  ctx.putImageData(frame, 0, 0);
  return canvas;
}
