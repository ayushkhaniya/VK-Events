// js/forms.js
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Basic validation is handled by HTML5 attributes
            const btn = document.getElementById('submit-btn');
            const originalText = btn.textContent;
            
            // Loading state
            btn.textContent = 'Sending...';
            btn.style.opacity = '0.7';
            btn.disabled = true;
            
            // Simulate network request
            setTimeout(() => {
                if (window.showToast) {
                    window.showToast('Message sent successfully! We will get back to you soon.');
                }
                
                // Reset form
                contactForm.reset();
                
                // Reset button
                btn.textContent = originalText;
                btn.style.opacity = '1';
                btn.disabled = false;
            }, 1500);
        });
    }
});
