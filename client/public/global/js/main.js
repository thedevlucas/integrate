document.addEventListener('DOMContentLoaded', () => {
    // Header scroll effect
    const header = document.querySelector('.header');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Professionals slider functionality
    const slider = document.querySelector('.professionals-container');
    const prevButton = document.querySelector('.slider-arrow.prev');
    const nextButton = document.querySelector('.slider-arrow.next');
    
    if (slider && prevButton && nextButton) {
        let scrollAmount = 0;
        const slideWidth = 300; // Card width + gap
        const maxScroll = slider.scrollWidth - slider.clientWidth;

        prevButton.addEventListener('click', () => {
            scrollAmount = Math.max(scrollAmount - slideWidth, 0);
            slider.style.transform = `translateX(-${scrollAmount}px)`;
            updateArrowVisibility();
        });

        nextButton.addEventListener('click', () => {
            scrollAmount = Math.min(scrollAmount + slideWidth, maxScroll);
            slider.style.transform = `translateX(-${scrollAmount}px)`;
            updateArrowVisibility();
        });

        function updateArrowVisibility() {
            prevButton.style.opacity = scrollAmount === 0 ? '0.5' : '1';
            nextButton.style.opacity = scrollAmount >= maxScroll ? '0.5' : '1';
        }

        // Initial arrow visibility
        updateArrowVisibility();

        // Update on window resize
        window.addEventListener('resize', () => {
            maxScroll = slider.scrollWidth - slider.clientWidth;
            scrollAmount = Math.min(scrollAmount, maxScroll);
            slider.style.transform = `translateX(-${scrollAmount}px)`;
            updateArrowVisibility();
        });
    }
});