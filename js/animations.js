// js/animations.js
class Animations {
    constructor() {
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.init();
    }
    
    init() {
        this.initHero();
        this.initScrollObserver();
    }
    
    // Hero reveal — runs once on load, no restart
    initHero() {
        const hero = document.getElementById('hero');
        if (!hero) return;
        
        if (this.reducedMotion) {
            // Instantly reveal everything
            hero.classList.add('hero--revealed');
            return;
        }
        
        // Small delay so layout settles, then reveal
        requestAnimationFrame(() => {
            setTimeout(() => {
                hero.classList.add('hero--revealed');
            }, 80);
        });
    }
    
    // General scroll-triggered animations for other sections
    initScrollObserver() {
        if (this.reducedMotion) {
            // Show everything immediately
            document.querySelectorAll('.js-observe').forEach(el => {
                el.classList.add('is-visible');
            });
            return;
        }
        
        const options = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };
        
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, options);
        
        document.querySelectorAll('.js-observe').forEach(el => {
            observer.observe(el);
        });
    }
}
