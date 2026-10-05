// js/main.js
// Toast System
window.showToast = function(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.classList.add('is-visible');
    });
    
    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => {
            toast.remove();
        }, 400); // Wait for transition
    }, 3000);
};

// Initialize common features
document.addEventListener('DOMContentLoaded', () => {
    new Navigation();
    new Animations();

    // Smooth scroll and auto-reveal if hash is in URL
    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
            targetEl.querySelectorAll('.js-observe').forEach(el => el.classList.add('is-visible'));
            setTimeout(() => {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 120);
        }
    }
});
