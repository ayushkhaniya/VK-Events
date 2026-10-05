// js/navigation.js
class Navigation {
    constructor() {
        this.nav = document.getElementById('main-nav');
        this.toggle = document.getElementById('nav-toggle');
        this.menu = document.getElementById('mobile-menu');
        this.body = document.body;
        
        if (this.nav && this.toggle && this.menu) {
            this.init();
        }
    }
    
    init() {
        // Scroll event
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                this.nav.classList.add('is-scrolled');
            } else {
                this.nav.classList.remove('is-scrolled');
            }
        });
        
        // Initial check
        if (window.scrollY > 50) {
            this.nav.classList.add('is-scrolled');
        }
        
        // Toggle mobile menu
        this.toggle.addEventListener('click', () => {
            this.toggleMenu();
        });
    }
    
    toggleMenu() {
        const isOpen = this.menu.classList.contains('is-open');
        
        if (isOpen) {
            this.menu.classList.remove('is-open');
            this.toggle.classList.remove('is-active');
            this.body.classList.remove('no-scroll');
        } else {
            this.menu.classList.add('is-open');
            this.toggle.classList.add('is-active');
            this.body.classList.add('no-scroll');
        }
    }
}
