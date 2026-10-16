// src/services/api.js
// ─────────────────────────────────────────────────────────
// VK Events — Media Data & API Layer
// Permanent server-backed image storage & metadata API
// ─────────────────────────────────────────────────────────

export const VK_CATEGORIES = [
  'All',
  'Birthday',
  'Anniversary',
  'Baby Welcome',
  'Haldi & Mehendi',
  'Religious & Pooja',
  'Ring Ceremony',
  'Shop Decoration',
  'Event Entry',
  'Our Inventory',
  'Other'
];

export const STATIC_MEDIA = [];

const API_BASE = (function () {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'file:') {
    return 'http://localhost:3000';
  }

  const currentPort = window.location.port;
  const hostname = window.location.hostname || 'localhost';
  const protocol = window.location.protocol || 'http:';

  // In live server or unusual port, point to backend 3000
  if (currentPort && currentPort !== '3000' && currentPort !== '5173') {
    return `${protocol}//${hostname}:3000`;
  }

  return '';
})();

/**
 * Fetch all media items:
 * Combines permanently uploaded server photos + built-in static showcase photos
 */
export async function getMedia() {
  try {
    const response = await fetch(`${API_BASE}/api/media`, {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }
    const json = await response.json();
    const rawItems = Array.isArray(json.data) ? json.data : [];

    const serverItems = rawItems.map(item => {
      const srcUrl = item.src && item.src.startsWith('http')
        ? item.src
        : `${API_BASE}${item.src}`;
      return {
        ...item,
        src: srcUrl,
        srcFull: item.srcFull && item.srcFull.startsWith('http') ? item.srcFull : srcUrl
      };
    });

    return [...serverItems, ...STATIC_MEDIA];
  } catch (err) {
    console.warn('Backend API connection note:', err.message);
    return [...STATIC_MEDIA];
  }
}

/**
 * Mobile-friendly client-side image compression using Canvas
 */
export function compressImage(file, maxDimension = 1920, quality = 0.85) {
  return new Promise((resolve) => {
    if (!file.type.match(/image\/(jpeg|jpg|png|webp)/i)) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxDimension && height <= maxDimension && file.size < 800 * 1024) {
          return resolve(file);
        }

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

/**
 * Upload image files to server permanently
 */
export async function uploadMediaFiles(files, category, onProgress, metaList = []) {
  if (!files || files.length === 0) {
    throw new Error('No files provided for upload');
  }

  const formData = new FormData();
  formData.append('category', category || 'Other');
  if (metaList && metaList.length > 0) {
    formData.append('metadata', JSON.stringify(metaList));
  }

  // Compress large photos before sending
  for (let i = 0; i < files.length; i++) {
    let fileToUpload = files[i];
    try {
      if (fileToUpload.size > 500 * 1024) {
        fileToUpload = await compressImage(fileToUpload, 1920, 0.85);
      }
    } catch (compErr) {
      console.warn('Client-side compression skipped:', compErr);
    }
    formData.append('images', fileToUpload, files[i].name);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/upload`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && typeof onProgress === 'function') {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          if (result.success) {
            const formatted = (result.data || []).map(item => {
              const srcUrl = item.src && item.src.startsWith('http')
                ? item.src
                : `${API_BASE}${item.src}`;
              const fullUrl = item.srcFull && item.srcFull.startsWith('http')
                ? item.srcFull
                : (item.srcFull ? `${API_BASE}${item.srcFull}` : srcUrl);
              return {
                ...item,
                src: srcUrl,
                srcFull: fullUrl
              };
            });
            resolve(formatted);
          } else {
            reject(new Error(result.error || 'Upload failed'));
          }
        } catch (parseErr) {
          reject(new Error('Invalid response from server'));
        }
      } else if (xhr.status === 405) {
        reject(new Error(`HTTP 405 Method Not Allowed. Please ensure the backend server is running (node server.js) and accessible at ${API_BASE || 'localhost:3000'}.`));
      } else {
        let msg = `Server error: HTTP ${xhr.status}`;
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData && errData.error) {
            msg = errData.error;
          }
        } catch (_) {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error(`Cannot connect to backend server at ${API_BASE || 'localhost:3000'}. Please ensure 'node server.js' is running.`));
    xhr.send(formData);
  });
}

/**
 * Permanently delete images by ID from server disk and database
 */
export async function deleteMediaPermanent(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  const response = await fetch(`${API_BASE}/api/media/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ ids })
  });

  if (!response.ok) {
    throw new Error(`Failed to delete images: HTTP ${response.status}`);
  }

  return await response.json();
}
