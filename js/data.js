// js/data.js
// ─────────────────────────────────────────────────────────
// VK Events — Media Data & API Layer
// Permanent server-backed image storage & metadata API
// Compatible with Live Server (port 5500), Node server (3000), & production
// ─────────────────────────────────────────────────────────

const VKData = {
    categories: [
        'All',
        'Birthday',
        'Anniversary',
        'Baby Welcome',
        'Haldi & Mehendi',
        'Religious & Pooja',
        'Ring Ceremony',
        'Shop Decoration',
        'Event Entry',
        'Wedding',
        'Other'
    ]
};

// ─── Static built-in project showcase images ─────────────
// Started from zero — all gallery images are added via Manage Work -> + Add Image
const STATIC_MEDIA = [];

// Determine API base URL dynamically
// If page is loaded via VS Code Live Server (port 5500) or file://,
// point API to the backend server on port 3000!
const API_BASE = (function () {
    if (window.location.protocol === 'file:') {
        return 'http://localhost:3000';
    }

    const currentPort = window.location.port;
    const hostname = window.location.hostname || 'localhost';
    const protocol = window.location.protocol || 'http:';

    // When running under Live Server (5500, 5501...) or any other port that isn't 3000
    if (currentPort && currentPort !== '3000') {
        return `${protocol}//${hostname}:3000`;
    }

    return window.location.origin;
})();

console.log(`[VK Events] API Endpoint connected to: ${API_BASE}`);

// ─── API Methods ─────────────────────────────────────────

/**
 * Fetch all media items:
 * Combines permanently uploaded server photos + built-in static showcase photos
 */
window.getMedia = async function () {
    try {
        const response = await fetch(`${API_BASE}/api/media`, {
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }
        const json = await response.json();
        const rawItems = Array.isArray(json.data) ? json.data : [];

        // Format src URLs so they load properly regardless of which port or origin serves the frontend
        const serverItems = rawItems.map(item => {
            const srcUrl = item.src && item.src.startsWith('http')
                ? item.src
                : `${API_BASE}${item.src}`;
            return {
                ...item,
                src: srcUrl,
                srcFull: (item.srcFull && item.srcFull.startsWith('http')) ? item.srcFull : srcUrl
            };
        });

        // Newly added server items appear first in the gallery
        return [...serverItems, ...STATIC_MEDIA];
    } catch (err) {
        console.warn('Backend API connection note:', err.message);
        return [...STATIC_MEDIA];
    }
};

/**
 * Upload image files to server permanently
 * @param {File[]} files - List of image File objects
 * @param {string} category - Selected category
 * @param {Function} onProgress - Progress callback (percentage)
 * @param {Object[]} metaList - Array of { spanType, aspectRatio } for each file
 * @returns {Promise<Object[]>} - Array of saved media records
 */
window.uploadMediaFiles = async function (files, category, onProgress, metaList = []) {
    if (!files || files.length === 0) {
        throw new Error('No files provided for upload');
    }

    const formData = new FormData();
    formData.append('category', category || 'Other');
    if (metaList && metaList.length > 0) {
        formData.append('metadata', JSON.stringify(metaList));
    }

    // Compress large photos on mobile / desktop before sending to save bandwidth
    for (let i = 0; i < files.length; i++) {
        let fileToUpload = files[i];
        try {
            if (fileToUpload.size > 500 * 1024) {
                fileToUpload = await window.compressImage(fileToUpload, 1920, 0.85);
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
                            return {
                                ...item,
                                src: srcUrl,
                                srcFull: srcUrl
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
                reject(new Error(`HTTP 405 Method Not Allowed. Please ensure the backend server is running (node server.js) and accessible at ${API_BASE}.`));
            } else {
                reject(new Error(`Server error: HTTP ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error(`Cannot connect to backend server at ${API_BASE}. Please ensure 'node server.js' is running.`));
        xhr.send(formData);
    });
};

/**
 * Permanently delete images by ID from server disk and database
 * @param {string[]} ids - Array of image IDs to delete
 * @returns {Promise<Object>}
 */
window.deleteMediaPermanent = async function (ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
        return { success: true, deletedCount: 0 };
    }

    const response = await fetch(`${API_BASE}/api/media/delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ ids })
    });

    if (!response.ok) {
        throw new Error(`Failed to delete images: HTTP ${response.status}`);
    }

    return await response.json();
};

/**
 * Mobile-friendly client-side image compression using Canvas
 * Scales image down smoothly to max dimension and outputs compressed JPEG blob
 */
window.compressImage = function (file, maxDimension = 1920, quality = 0.85) {
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
};
