document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mainNav = document.querySelector('.main-nav');
    const body = document.body;

    mobileMenuBtn?.addEventListener('click', () => {
        mainNav?.classList.toggle('active');
        mobileMenuBtn.classList.toggle('mobile-menu-active');
        body.style.overflow = mainNav?.classList.contains('active') ? 'hidden' : '';
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (mainNav?.classList.contains('active') && 
            !e.target.closest('.main-nav') && 
            !e.target.closest('.mobile-menu-btn')) {
            mainNav.classList.remove('active');
            mobileMenuBtn.classList.remove('mobile-menu-active');
            body.style.overflow = '';
        }
    });

    // Close mobile menu when clicking on a link
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mainNav?.classList.contains('active')) {
                mainNav.classList.remove('active');
                mobileMenuBtn.classList.remove('mobile-menu-active');
                body.style.overflow = '';
            }
        });
    });
});