// js/lightbox.js
class Lightbox {
    constructor() {
        this.modal = document.getElementById('lightbox');
        this.content = document.getElementById('lb-content');
        this.cat = document.getElementById('lb-cat');
        this.counter = document.getElementById('lb-counter');
        this.closeBtn = document.getElementById('lb-close');
        this.prevBtn = document.getElementById('lb-prev');
        this.nextBtn = document.getElementById('lb-next');
        
        this.mediaList = [];
        this.currentIndex = 0;
        
        if (this.modal) {
            this.init();
        }
    }
    
    init() {
        this.closeBtn.addEventListener('click', () => this.close());
        this.prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.prev(); });
        this.nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.next(); });
        
        // Close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal || e.target === this.content) {
                this.close();
            }
        });
        
        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (!this.modal.classList.contains('is-open')) return;
            
            if (e.key === 'Escape') this.close();
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });
    }
    
    open(mediaList, index) {
        this.mediaList = mediaList;
        this.currentIndex = index;
        
        this.renderCurrent();
        
        this.modal.classList.add('is-open');
        document.body.classList.add('no-scroll');
    }
    
    close() {
        this.modal.classList.remove('is-open');
        document.body.classList.remove('no-scroll');
        
        // Stop video if playing
        const mediaContainer = this.content.querySelector('.lightbox__media-container');
        if (mediaContainer) {
            mediaContainer.remove();
        }
    }
    
    prev() {
        if (this.mediaList.length <= 1) return;
        this.currentIndex = (this.currentIndex - 1 + this.mediaList.length) % this.mediaList.length;
        this.renderCurrent();
    }
    
    next() {
        if (this.mediaList.length <= 1) return;
        this.currentIndex = (this.currentIndex + 1) % this.mediaList.length;
        this.renderCurrent();
    }
    
    renderCurrent() {
        const media = this.mediaList[this.currentIndex];
        
        this.cat.textContent = media.category || '';
        this.counter.textContent = `${this.currentIndex + 1} / ${this.mediaList.length}`;
        
        // Remove existing media
        const existing = this.content.querySelector('.lightbox__media-container');
        if (existing) existing.remove();
        
        // Create new
        const container = document.createElement('div');
        container.className = 'lightbox__media-container';
        
        if (media.type === 'video') {
            container.innerHTML = `<video src="${media.src}" controls autoplay></video>`;
        } else {
            container.innerHTML = `<img src="${media.src}" alt="${media.category || 'Event Decoration'}">`;
        }
        
        this.content.appendChild(container);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.lightbox = new Lightbox();
});
