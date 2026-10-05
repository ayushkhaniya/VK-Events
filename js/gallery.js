// js/gallery.js
// ─────────────────────────────────────────────────────────
// VK Events — Gallery with Permanent Server-Backed Storage
// Automatic Bento/Masonry Grid Layout for all images (static + uploaded)
// Supports mobile uploads, client-side compression, permanent deletions
// ─────────────────────────────────────────────────────────

class Gallery {
    constructor() {
        this.grid = document.getElementById('gallery-grid');
        this.filtersContainer = document.getElementById('gallery-filters');
        this.currentFilter = 'All';
        this.allMedia = [];
        this.deleteMode = false;
        this.selectedForDelete = new Set();

        if (this.grid && this.filtersContainer) {
            this.init();
        }
    }

    async init() {
        this.renderFilters();
        this.renderManageBar();
        this.renderGalleryLoading();
        try {
            this.allMedia = await window.getMedia();
        } catch (err) {
            console.error('Failed to load gallery items:', err);
            this.allMedia = [];
        }
        this.renderGallery();
    }

    // ── Filters ─────────────────────────────────────────
    renderFilters() {
        this.filtersContainer.innerHTML = '';
        VKData.categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `filter-btn ${cat === this.currentFilter ? 'active' : ''}`;
            btn.textContent = cat;
            btn.addEventListener('click', () => {
                if (this.deleteMode) return; // lock filters during delete mode
                this.currentFilter = cat;
                this.updateActiveFilter();
                this.renderGallery();
            });
            this.filtersContainer.appendChild(btn);
        });
    }

    updateActiveFilter() {
        this.filtersContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent === this.currentFilter);
        });
    }

    // ── Manage Bar ───────────────────────────────────────
    renderManageBar() {
        const section = this.grid.parentElement;
        if (document.getElementById('manage-bar')) return;

        const bar = document.createElement('div');
        bar.id = 'manage-bar';
        bar.className = 'manage-bar';
        bar.innerHTML = `
            <div class="manage-bar__inner">
                <div class="manage-dropdown" id="manage-dropdown">
                    <button class="manage-trigger" id="manage-trigger" aria-haspopup="true" aria-expanded="false" type="button">
                        Manage Work <span class="manage-trigger__arrow">▾</span>
                    </button>
                    <div class="manage-menu" id="manage-menu" role="menu">
                        <button class="manage-menu__item" id="btn-add-image" role="menuitem" type="button">
                            <span class="manage-menu__icon">＋</span> Add Image
                        </button>
                        <button class="manage-menu__item" id="btn-delete-mode" role="menuitem" type="button">
                            <span class="manage-menu__icon">🗑</span> Select &amp; Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
        section.insertBefore(bar, this.grid);

        // Dropdown toggle
        const trigger = bar.querySelector('#manage-trigger');
        const menu = bar.querySelector('#manage-menu');
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = menu.classList.toggle('is-open');
            trigger.setAttribute('aria-expanded', open);
        });

        document.addEventListener('click', () => {
            menu.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', false);
        });

        // Add Image button
        bar.querySelector('#btn-add-image').addEventListener('click', () => {
            menu.classList.remove('is-open');
            this.openAddImageModal();
        });

        // Delete mode button
        bar.querySelector('#btn-delete-mode').addEventListener('click', () => {
            menu.classList.remove('is-open');
            this.enterDeleteMode();
        });
    }

    // ── Bento Grid Span: Large (2×2) or Normal (1×1) ─────
    getBentoSpanClass(media, index) {
        // If span was already determined and stored
        if (media.spanType === 'large') return 'gallery-item--large';
        if (media.spanType === 'normal') return 'gallery-item--normal';

        // Featured items are always large
        if (media.featured || media.isFeatured) return 'gallery-item--large';

        // Determine from aspect ratio if available
        if (media.aspectRatio) {
            return `gallery-item--${this.computeSpanFromRatio(media.aspectRatio, index)}`;
        }

        // Fallback: every 5th item is large (5th, 10th...), rest are normal
        return ((index + 1) % 5 === 0) ? 'gallery-item--large' : 'gallery-item--normal';
    }

    computeSpanFromRatio(ratio, index = 0) {
        // Every 5th item is large (5th, 10th, 15th...)
        if ((index + 1) % 5 === 0) return 'large';
        // Landscape images (ratio > 1.25): alternate into large heroes so they don't stack full-width
        if (ratio > 1.25 && index % 2 === 1) return 'large';
        // Everything else is normal (1 col × 1 row, exactly 2 per row on 360px mobile)
        return 'normal';
    }

    // ── Gallery Render ───────────────────────────────────
    renderGalleryLoading() {
        this.grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0;">
                <div class="loading-spinner"></div>
                <p class="text-muted" style="margin-top: 16px;">Loading gallery…</p>
            </div>`;
    }

    renderGallery() {
        this.grid.innerHTML = '';

        const filtered = this.currentFilter === 'All'
            ? this.allMedia
            : this.allMedia.filter(m => m.category === this.currentFilter);

        if (filtered.length === 0) {
            if (this.allMedia.length === 0) {
                this.grid.innerHTML = `
                    <div class="gallery-empty-state">
                        <div class="gallery-empty-state__box">
                            <div class="gallery-empty-state__icon">🖼️</div>
                            <h3 class="gallery-empty-state__title">Gallery is Currently Empty</h3>
                            <p class="gallery-empty-state__desc">No decoration photos uploaded yet. Tap below or use <strong>Manage Work</strong> above to start adding photos from your mobile phone.</p>
                            <button class="btn btn--primary gallery-empty-state__btn" id="btn-empty-add-image" type="button">
                                <span>＋</span> Add Image
                            </button>
                        </div>
                    </div>`;
                const btnAdd = this.grid.querySelector('#btn-empty-add-image');
                if (btnAdd) {
                    btnAdd.addEventListener('click', () => this.openAddImageModal());
                }
            } else {
                this.grid.innerHTML = `<p class="text-muted" style="grid-column: 1 / -1; text-align: center; padding: 50px 0;">No photos in "${this.currentFilter}" yet.</p>`;
            }
            return;
        }

        filtered.forEach((media, index) => {
            const item = document.createElement('div');
            const spanClass = this.getBentoSpanClass(media, index);
            item.className = `gallery-item ${spanClass} js-observe animate-fade-up`;
            item.style.transitionDelay = `${(index % 4) * 0.08}s`;
            item.dataset.id = media.id;
            if (media.isStatic) {
                item.dataset.static = "true";
            }

            setTimeout(() => item.classList.add('is-visible'), 40);

            item.innerHTML = `
                <img src="${media.src}" alt="${media.category || 'Event Decoration'}" loading="lazy">
                <div class="gallery-item__overlay">
                    <span class="gallery-item__cat">${media.category}</span>
                </div>
                ${this.deleteMode ? `
                    <div class="delete-select-indicator ${this.selectedForDelete.has(media.id) ? 'is-selected' : ''}">
                        <span class="delete-check">✓</span>
                    </div>` : ''}
            `;

            // Auto-detect span from image dimensions if no spanType stored
            const img = item.querySelector('img');
            if (img && !media.spanType && !media.aspectRatio) {
                img.addEventListener('load', () => {
                    if (img.naturalWidth && img.naturalHeight) {
                        const ratio = img.naturalWidth / img.naturalHeight;
                        const span = this.computeSpanFromRatio(ratio, index);
                        item.classList.remove('gallery-item--normal', 'gallery-item--large');
                        item.classList.add(`gallery-item--${span}`);
                    }
                });
            }

            if (this.deleteMode) {
                item.addEventListener('click', () => this.toggleDeleteSelect(media, item));
            } else {
                item.addEventListener('click', () => {
                    if (window.lightbox) {
                        const list = filtered.map(m => ({ ...m, src: m.srcFull || m.src }));
                        window.lightbox.open(list, index);
                    }
                });
            }

            this.grid.appendChild(item);
        });
    }

    // ── Add Image Modal ──────────────────────────────────
    openAddImageModal() {
        const old = document.getElementById('add-image-modal');
        if (old) old.remove();

        const modal = document.createElement('div');
        modal.id = 'add-image-modal';
        modal.className = 'work-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Add Image');

        const categoryOptions = VKData.categories
            .filter(c => c !== 'All')
            .map(c => `<option value="${c}">${c}</option>`)
            .join('');

        modal.innerHTML = `
            <div class="work-modal__box">
                <div class="work-modal__head">
                    <h3 class="work-modal__title">Add Image to Gallery</h3>
                    <button class="work-modal__close" id="add-modal-close" aria-label="Close" type="button">✕</button>
                </div>
                <div class="work-modal__body">
                    <div class="add-dropzone" id="add-dropzone">
                        <input type="file" id="add-file-input" accept="image/*" multiple>
                        <div class="add-dropzone__icon">📸</div>
                        <p class="add-dropzone__text">Tap to select or take photos</p>
                        <p class="add-dropzone__sub">JPG, PNG, WEBP — Multiple allowed</p>
                    </div>
                    <div class="add-previews" id="add-previews"></div>
                    <div class="add-form">
                        <label class="add-label" for="add-category">Category</label>
                        <select id="add-category" class="add-select">${categoryOptions}</select>
                    </div>
                    <div class="upload-progress-wrap" id="upload-progress-wrap">
                        <div class="upload-progress-bar">
                            <div class="upload-progress-fill" id="upload-progress-fill"></div>
                        </div>
                        <div class="upload-progress-text" id="upload-progress-text">Preparing upload…</div>
                    </div>
                    <div class="work-modal__actions">
                        <button class="btn btn--outline btn--sm" id="add-cancel" type="button">Cancel</button>
                        <button class="btn btn--primary btn--sm" id="add-confirm" disabled type="button">Upload to Gallery</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('is-open'));

        let pendingFiles = [];

        const fileInput = modal.querySelector('#add-file-input');
        const dropzone = modal.querySelector('#add-dropzone');
        const previewsEl = modal.querySelector('#add-previews');
        const confirmBtn = modal.querySelector('#add-confirm');
        const progressWrap = modal.querySelector('#upload-progress-wrap');
        const progressFill = modal.querySelector('#upload-progress-fill');
        const progressText = modal.querySelector('#upload-progress-text');

        const close = () => {
            modal.classList.remove('is-open');
            setTimeout(() => modal.remove(), 300);
        };

        modal.querySelector('#add-modal-close').addEventListener('click', close);
        modal.querySelector('#add-cancel').addEventListener('click', close);
        modal.addEventListener('click', (e) => {
            if (e.target === modal && !confirmBtn.disabled) close();
        });

        // Trigger file picker
        dropzone.addEventListener('click', (e) => {
            if (e.target !== fileInput) fileInput.click();
        });

        // Drag & drop
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('is-dragover');
        });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('is-dragover');
            handleFiles([...e.dataTransfer.files]);
        });

        fileInput.addEventListener('change', () => handleFiles([...fileInput.files]));

        function handleFiles(files) {
            const valid = files.filter(f => f.type.startsWith('image/'));
            if (valid.length === 0) return;
            pendingFiles = [...pendingFiles, ...valid];
            renderPreviews();
            confirmBtn.disabled = pendingFiles.length === 0;
        }

        function renderPreviews() {
            previewsEl.innerHTML = '';
            pendingFiles.forEach((file, i) => {
                const url = URL.createObjectURL(file);
                const wrap = document.createElement('div');
                wrap.className = 'add-preview-item';
                wrap.innerHTML = `
                    <img src="${url}" alt="${file.name}">
                    <button class="add-preview-remove" data-i="${i}" title="Remove" type="button">✕</button>
                `;
                previewsEl.appendChild(wrap);
            });

            previewsEl.querySelectorAll('.add-preview-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(btn.dataset.i, 10);
                    pendingFiles.splice(index, 1);
                    renderPreviews();
                    confirmBtn.disabled = pendingFiles.length === 0;
                });
            });
        }

        // Helper to detect aspect ratio of a file before upload
        const getFileAspectRatio = (file) => {
            return new Promise((resolve) => {
                const url = URL.createObjectURL(file);
                const img = new Image();
                img.onload = () => {
                    const w = img.naturalWidth || 1;
                    const h = img.naturalHeight || 1;
                    URL.revokeObjectURL(url);
                    resolve(w / h);
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve(1.0);
                };
                img.src = url;
            });
        };

        // Upload to server permanently
        confirmBtn.addEventListener('click', async () => {
            if (pendingFiles.length === 0) return;

            confirmBtn.disabled = true;
            modal.querySelector('#add-cancel').disabled = true;
            modal.querySelector('#add-modal-close').style.display = 'none';
            progressWrap.classList.add('is-active');
            progressFill.style.width = '10%';
            progressText.textContent = `Analyzing & optimizing ${pendingFiles.length} photo(s)…`;

            const category = modal.querySelector('#add-category').value;

            try {
                // Calculate aspect ratio and Bento span for each file to ensure layout integration
                const metaList = [];
                for (let i = 0; i < pendingFiles.length; i++) {
                    const ratio = await getFileAspectRatio(pendingFiles[i]);
                    const spanType = this.computeSpanFromRatio(ratio, this.allMedia.length + i);
                    metaList.push({
                        aspectRatio: Math.round(ratio * 100) / 100,
                        spanType: spanType
                    });
                }

                const newItems = await window.uploadMediaFiles(pendingFiles, category, (percent) => {
                    progressFill.style.width = `${Math.max(10, percent)}%`;
                    progressText.textContent = `Uploading… ${percent}%`;
                }, metaList);

                progressFill.style.width = '100%';
                progressText.textContent = 'Upload complete!';

                // Prepend newly uploaded items to gallery
                if (Array.isArray(newItems) && newItems.length > 0) {
                    this.allMedia = [...newItems, ...this.allMedia];
                }

                setTimeout(() => {
                    close();
                    this.renderGallery();
                    if (window.showToast) {
                        window.showToast(`${pendingFiles.length} photo${pendingFiles.length > 1 ? 's' : ''} added to Bento gallery.`);
                    }
                }, 500);

            } catch (err) {
                console.error('Upload failed:', err);
                progressWrap.classList.remove('is-active');
                confirmBtn.disabled = false;
                modal.querySelector('#add-cancel').disabled = false;
                modal.querySelector('#add-modal-close').style.display = '';
                alert(`Upload failed: ${err.message || 'Please check your connection and try again.'}`);
            }
        });
    }

    // ── Delete Mode ──────────────────────────────────────
    enterDeleteMode() {
        this.deleteMode = true;
        this.selectedForDelete.clear();
        this.currentFilter = 'All';
        this.updateActiveFilter();
        this.renderGallery();
        this.renderDeleteBar();
    }

    exitDeleteMode() {
        this.deleteMode = false;
        this.selectedForDelete.clear();
        this.renderGallery();
        const bar = document.getElementById('delete-action-bar');
        if (bar) bar.remove();
    }

    renderDeleteBar() {
        const old = document.getElementById('delete-action-bar');
        if (old) old.remove();

        const bar = document.createElement('div');
        bar.id = 'delete-action-bar';
        bar.className = 'delete-action-bar';
        bar.innerHTML = `
            <div class="delete-action-bar__inner">
                <span class="delete-action-bar__hint" id="delete-hint">Tap uploaded photos to select for permanent deletion</span>
                <div class="delete-action-bar__btns">
                    <button class="btn btn--outline btn--sm" id="delete-cancel-btn" type="button">Cancel</button>
                    <button class="btn btn--danger btn--sm" id="delete-confirm-btn" disabled type="button">Delete Selected (<span id="delete-count">0</span>)</button>
                </div>
            </div>
        `;
        document.body.appendChild(bar);
        requestAnimationFrame(() => bar.classList.add('is-visible'));

        bar.querySelector('#delete-cancel-btn').addEventListener('click', () => this.exitDeleteMode());
        bar.querySelector('#delete-confirm-btn').addEventListener('click', () => this.confirmDelete());
    }

    toggleDeleteSelect(media, item) {
        if (media.isStatic) {
            if (window.showToast) window.showToast('Built-in showcase photos are protected and cannot be deleted.');
            return;
        }

        const indicator = item.querySelector('.delete-select-indicator');
        if (this.selectedForDelete.has(media.id)) {
            this.selectedForDelete.delete(media.id);
            if (indicator) indicator.classList.remove('is-selected');
        } else {
            this.selectedForDelete.add(media.id);
            if (indicator) indicator.classList.add('is-selected');
        }

        const count = this.selectedForDelete.size;
        const countEl = document.getElementById('delete-count');
        const confirmBtn = document.getElementById('delete-confirm-btn');
        if (countEl) countEl.textContent = count;
        if (confirmBtn) confirmBtn.disabled = count === 0;
    }

    async confirmDelete() {
        if (this.selectedForDelete.size === 0) return;
        const n = this.selectedForDelete.size;
        const ok = confirm(`Permanently delete ${n} selected image${n > 1 ? 's' : ''}?\n\nThis removes the photo from the server permanently.`);
        if (!ok) return;

        const confirmBtn = document.getElementById('delete-confirm-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Deleting…';
        }

        const ids = [...this.selectedForDelete];

        try {
            await window.deleteMediaPermanent(ids);
            this.allMedia = this.allMedia.filter(m => !ids.includes(m.id));
            this.exitDeleteMode();
            if (window.showToast) {
                window.showToast(`${n} image${n > 1 ? 's' : ''} permanently deleted.`);
            }
        } catch (err) {
            console.error('Delete failed:', err);
            alert(`Delete failed: ${err.message}`);
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = `Delete Selected (${n})`;
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.gallery = new Gallery();
});
