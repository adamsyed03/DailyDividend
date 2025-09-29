// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    // Add smooth scrolling to all anchor links
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 80; // Account for fixed navbar
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Phone number formatting - simplified approach
    const phoneInputs = document.querySelectorAll('#phoneInput, #phoneInputBottom');
    const countryCodeInputs = document.querySelectorAll('#countryCode, #countryCodeBottom');
    
    // Handle country code inputs
    countryCodeInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            let value = e.target.value;
            // Ensure it starts with +
            if (!value.startsWith('+')) {
                value = '+' + value.replace(/[^0-9]/g, '');
            } else {
                value = '+' + value.replace(/[^0-9]/g, '');
            }
            e.target.value = value;
        });
    });
    
    // Handle phone number inputs - simple numeric only
    phoneInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            // Remove all non-numeric characters
            let value = e.target.value.replace(/\D/g, '');
            
            // Limit to 15 digits (international standard)
            if (value.length > 15) {
                value = value.substring(0, 15);
            }
            
            e.target.value = value;
        });
    });

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    let lastScrollTop = 0;

    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down
            navbar.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up
            navbar.style.transform = 'translateY(0)';
        }
        
        lastScrollTop = scrollTop;
    });

    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animatedElements = document.querySelectorAll('.feature-card, .step, .testimonial, .pricing-card');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// WhatsApp signup function
function startWhatsAppSignup() {
    // Get country code and phone number
    const countryCodeInput = document.querySelector('#countryCode') || document.querySelector('#countryCodeBottom');
    const phoneInput = document.querySelector('#phoneInput') || document.querySelector('#phoneInputBottom');
    
    const countryCode = countryCodeInput ? countryCodeInput.value.trim() : '+44';
    const phoneNumber = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';

    // Validate inputs
    if (!countryCode || !countryCode.startsWith('+')) {
        showNotification('Please enter a valid country code (e.g., +44)', 'error');
        return;
    }

    if (!phoneNumber || phoneNumber.length < 7) {
        showNotification('Please enter a valid phone number', 'error');
        return;
    }

    // Show loading state
    const buttons = document.querySelectorAll('.cta-button');
    buttons.forEach(button => {
        button.disabled = true;
        button.classList.add('loading');
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    });

    // Simulate API call delay
    setTimeout(() => {
        // Format phone number for WhatsApp
        const formattedNumber = `${countryCode}${phoneNumber}`;
        const cleanCountryCode = countryCode.replace('+', '');
        
        // Create WhatsApp URL
        const message = `Hi! I'd like to sign up for Daily Dividend finance news and education. My phone number is ${formattedNumber}.`;
        const whatsappUrl = `https://wa.me/${cleanCountryCode}${phoneNumber}?text=${encodeURIComponent(message)}`;
        
        // Open WhatsApp
        window.open(whatsappUrl, '_blank');
        
        // Reset button states
        buttons.forEach(button => {
            button.disabled = false;
            button.classList.remove('loading');
            button.innerHTML = '<i class="fab fa-whatsapp"></i> Get Started Free';
        });

        // Show success message
        showNotification('WhatsApp opened! Please send the message to complete your signup.', 'success');
        
        // Track signup attempt (you can integrate with analytics here)
        trackEvent('signup_attempt', {
            phone_number: formattedNumber,
            source: 'landing_page'
        });
        
    }, 1500);
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 15px;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        .notification-content {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
        }
        .notification-close {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            padding: 5px;
            border-radius: 5px;
            transition: background 0.2s ease;
        }
        .notification-close:hover {
            background: rgba(255, 255, 255, 0.2);
        }
    `;
    document.head.appendChild(style);

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Analytics tracking function
function trackEvent(eventName, properties = {}) {
    // This is where you would integrate with your analytics service
    // For example: Google Analytics, Mixpanel, etc.
    console.log('Event tracked:', eventName, properties);
    
    // Example Google Analytics 4 integration:
    // if (typeof gtag !== 'undefined') {
    //     gtag('event', eventName, properties);
    // }
}

// Form validation
function validatePhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length === 10 && /^\d{10}$/.test(cleaned);
}

// Keyboard navigation support
document.addEventListener('keydown', function(e) {
    // Enter key on phone input should trigger signup
    if (e.key === 'Enter' && e.target.type === 'tel') {
        startWhatsAppSignup();
    }
});

// Add loading state to buttons when clicked
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('cta-button') || e.target.classList.contains('pricing-button')) {
        // The loading state is handled in startWhatsAppSignup()
        // This is just for any other button clicks
    }
});

// Lazy loading for images (if you add any later)
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
}

// Initialize lazy loading
document.addEventListener('DOMContentLoaded', lazyLoadImages);

// Add some interactive effects
document.addEventListener('DOMContentLoaded', function() {
    // Add hover effects to feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Add click effects to buttons
    const buttons = document.querySelectorAll('.cta-button, .pricing-button');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            // Create ripple effect
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s ease-out;
                pointer-events: none;
            `;
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    });

    // Add ripple animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(2);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});

// Performance optimization: Debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debouncing to scroll events
const debouncedScrollHandler = debounce(function() {
    // Any scroll-based functionality can go here
}, 10);

window.addEventListener('scroll', debouncedScrollHandler);
