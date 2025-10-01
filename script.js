/**
 * Daily Dividend - Professional Landing Page JavaScript
 * ===================================================
 * 
 * A comprehensive JavaScript module for the Daily Dividend landing page.
 * Features smooth scrolling, form validation, WhatsApp integration,
 * and modern UI interactions with accessibility support.
 * 
 * @fileoverview Main JavaScript file for Daily Dividend landing page
 * @author Daily Dividend Team
 * @version 2.0
 * @since 2024
 */

/**
 * Main application initialization and event listeners
 * Handles DOM ready state and initializes all components
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeSmoothScrolling();
    initializePhoneInputs();
    initializeNavbarScrollEffect();
    initializeAnimations();
    initializeInteractiveEffects();
});

/**
 * Initialize smooth scrolling for navigation links
 * Provides smooth scroll behavior for anchor links with navbar offset
 * @function initializeSmoothScrolling
 * @returns {void}
 */
function initializeSmoothScrolling() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                // Account for fixed navbar height (70px + 10px buffer)
                const offsetTop = targetElement.offsetTop - 80;
                
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
                
                // Update focus for accessibility
                targetElement.focus();
            }
        });
    });
}

/**
 * Initialize phone number input formatting and validation
 * Handles country code and phone number input formatting
 * @function initializePhoneInputs
 * @returns {void}
 */
function initializePhoneInputs() {
    const phoneInputs = document.querySelectorAll('#phoneInput, #phoneInputBottom');
    const countryCodeInputs = document.querySelectorAll('#countryCode, #countryCodeBottom');
    
    // Handle country code inputs
    countryCodeInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            let value = e.target.value;
            
            // Ensure it starts with + and contains only numbers
            if (!value.startsWith('+')) {
                value = '+' + value.replace(/[^0-9]/g, '');
            } else {
                value = '+' + value.replace(/[^0-9]/g, '');
            }
            
            e.target.value = value;
        });
        
        // Add validation feedback
        input.addEventListener('blur', function(e) {
            validateCountryCode(e.target);
        });
    });
    
    // Handle phone number inputs - numeric only with length validation
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
        
        // Add validation feedback
        input.addEventListener('blur', function(e) {
            validatePhoneNumber(e.target);
        });
    });
}

/**
 * Validate country code input
 * @param {HTMLInputElement} input - The country code input element
 * @returns {boolean} - Whether the country code is valid
 */
function validateCountryCode(input) {
    const value = input.value.trim();
    const isValid = value.startsWith('+') && value.length >= 2 && value.length <= 4;
    
    if (!isValid) {
        input.setAttribute('aria-invalid', 'true');
        input.classList.add('error');
    } else {
        input.setAttribute('aria-invalid', 'false');
        input.classList.remove('error');
    }
    
    return isValid;
}

/**
 * Validate phone number input
 * @param {HTMLInputElement} input - The phone number input element
 * @returns {boolean} - Whether the phone number is valid
 */
function validatePhoneNumber(input) {
    const value = input.value.trim();
    const isValid = value.length >= 7 && value.length <= 15 && /^\d+$/.test(value);
    
    if (!isValid) {
        input.setAttribute('aria-invalid', 'true');
        input.classList.add('error');
    } else {
        input.setAttribute('aria-invalid', 'false');
        input.classList.remove('error');
    }
    
    return isValid;
}

/**
 * Initialize navbar scroll behavior
 * Hides navbar when scrolling down, shows when scrolling up
 * @function initializeNavbarScrollEffect
 * @returns {void}
 */
function initializeNavbarScrollEffect() {
    const navbar = document.querySelector('.navbar');
    let lastScrollTop = 0;
    let ticking = false;

    function updateNavbar() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down - hide navbar
            navbar.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up - show navbar
            navbar.style.transform = 'translateY(0)';
        }
        
        lastScrollTop = scrollTop;
        ticking = false;
    }

    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateNavbar);
            ticking = true;
        }
    }

    window.addEventListener('scroll', requestTick, { passive: true });
}

/**
 * Initialize scroll-triggered animations
 * Uses Intersection Observer for performance-optimized animations
 * @function initializeAnimations
 * @returns {void}
 */
function initializeAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                
                // Add animation class for additional effects
                entry.target.classList.add('animate-in');
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
}

/**
 * Initialize interactive effects and micro-interactions
 * Handles hover effects, button animations, and user feedback
 * @function initializeInteractiveEffects
 * @returns {void}
 */
function initializeInteractiveEffects() {
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
            createRippleEffect(e, this);
        });
    });
}

/**
 * Create ripple effect on button click
 * @param {MouseEvent} event - The click event
 * @param {HTMLElement} element - The button element
 * @returns {void}
 */
function createRippleEffect(event, element) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
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
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
}

/**
 * Main WhatsApp signup function
 * Handles form validation, phone number formatting, WhatsApp integration,
 * and data submission to Google Apps Script
 * @function startWhatsAppSignup
 * @returns {void}
 */
function startWhatsAppSignup() {
    // Get form inputs
    const countryCodeInput = document.querySelector('#countryCode') || document.querySelector('#countryCodeBottom');
    const phoneInput = document.querySelector('#phoneInput') || document.querySelector('#phoneInputBottom');
    
    const countryCode = countryCodeInput ? countryCodeInput.value.trim() : '+44';
    const phoneNumber = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';

    // Validate country code
    if (!countryCode || !countryCode.startsWith('+')) {
        showNotification('Please enter a valid country code (e.g., +44)', 'error');
        countryCodeInput?.focus();
        return;
    }

    // Validate phone number
    if (!phoneNumber || phoneNumber.length < 7) {
        showNotification('Please enter a valid phone number', 'error');
        phoneInput?.focus();
        return;
    }

    // Show loading state
    setButtonLoadingState(true);

    // Format phone number for WhatsApp
    const formattedNumber = `${countryCode}${phoneNumber}`;
    const cleanCountryCode = countryCode.replace('+', '');

    // Submit data to Google Apps Script first
    submitToGoogleAppsScript(formattedNumber, countryCode, phoneNumber)
        .then(() => {
            // After successful submission, open WhatsApp
            try {
                // Create WhatsApp URL with pre-filled message
                const message = `Hi! I'd like to sign up for Daily Dividend finance news and education. My phone number is ${formattedNumber}.`;
                const whatsappUrl = `https://wa.me/${cleanCountryCode}${phoneNumber}?text=${encodeURIComponent(message)}`;
                
                // Open WhatsApp in new tab
                window.open(whatsappUrl, '_blank');
                
                // Show success message
                showNotification('Data saved! WhatsApp opened. Please send the message to complete your signup.', 'success');
                
                // Track signup attempt for analytics
                trackEvent('signup_attempt', {
                    phone_number: formattedNumber,
                    source: 'landing_page',
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('Error opening WhatsApp:', error);
                showNotification('Data saved! Unable to open WhatsApp. Please try again.', 'warning');
            }
        })
        .catch((error) => {
            console.error('Error submitting to Google Apps Script:', error);
            showNotification('Unable to save data. Please try again.', 'error');
        })
        .finally(() => {
            // Reset button states
            setButtonLoadingState(false);
        });
}

/**
 * Submit phone number data to Google Apps Script
 * @param {string} formattedNumber - The complete formatted phone number
 * @param {string} countryCode - The country code
 * @param {string} phoneNumber - The phone number without country code
 * @returns {Promise} - Promise that resolves when data is submitted
 */
function submitToGoogleAppsScript(formattedNumber, countryCode, phoneNumber) {
    const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbzDeCNco-q8b8xOktCi9bTih50B5_DMqZb_DK3Br98mQJLAQq281Pm7K3SaZCINktA6/exec';
    
    const formData = {
        name: 'Daily Dividend Signup',
        email: 'signup@dailydividend.com',
        product: 'Daily Dividend WhatsApp Service',
        quantity: 1,
        comments: `Phone: ${formattedNumber}, Country Code: ${countryCode}, Raw Phone: ${phoneNumber}, Source: Landing Page, Timestamp: ${new Date().toISOString()}`,
        phone_number: formattedNumber,
        country_code: countryCode,
        raw_phone: phoneNumber,
        source: 'landing_page',
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        referrer: document.referrer || 'direct'
    };

    return fetch(googleScriptUrl, {
        method: 'POST',
        mode: 'no-cors', // Required for Google Apps Script
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    })
    .then(response => {
        // Note: With no-cors mode, we can't read the response
        // But the data should still be submitted to Google Apps Script
        console.log('Data submitted to Google Apps Script successfully');
        return Promise.resolve();
    })
    .catch(error => {
        console.error('Error submitting to Google Apps Script:', error);
        throw error;
    });
}

/**
 * Set loading state for all CTA buttons
 * @param {boolean} isLoading - Whether to show loading state
 * @returns {void}
 */
function setButtonLoadingState(isLoading) {
    const buttons = document.querySelectorAll('.cta-button, .pricing-button');
    buttons.forEach(button => {
        if (isLoading) {
            button.disabled = true;
            button.classList.add('loading');
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            button.innerHTML = '<i class="fab fa-whatsapp"></i> Get Started Free';
        }
    });
}

/**
 * Show notification to user
 * Creates and displays a toast notification with auto-dismiss
 * @param {string} message - The notification message
 * @param {string} type - The notification type ('success', 'error', 'info', 'warning')
 * @returns {void}
 */
function showNotification(message, type = 'info') {
    // Remove existing notifications to prevent stacking
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    
    // Get appropriate icon for notification type
    const iconMap = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    notification.innerHTML = `
        <div class="notification__content">
            <i class="fas fa-${iconMap[type] || 'info-circle'}" aria-hidden="true"></i>
            <span>${message}</span>
        </div>
        <button class="notification__close" 
                onclick="this.parentElement.remove()"
                aria-label="Close notification">
            <i class="fas fa-times" aria-hidden="true"></i>
        </button>
    `;

    // Add dynamic styles based on type
    const colorMap = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };

    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        background: ${colorMap[type] || '#3b82f6'};
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

    // Add notification styles if not already present
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
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
            .notification__content {
                display: flex;
                align-items: center;
                gap: 10px;
                flex: 1;
            }
            .notification__close {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 5px;
                border-radius: 5px;
                transition: background 0.2s ease;
            }
            .notification__close:hover {
                background: rgba(255, 255, 255, 0.2);
            }
        `;
        document.head.appendChild(style);
    }

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

/**
 * Track analytics events
 * Centralized analytics tracking function for user interactions
 * @param {string} eventName - The name of the event to track
 * @param {Object} properties - Additional properties to track with the event
 * @returns {void}
 */
function trackEvent(eventName, properties = {}) {
    // Log to console for development
    console.log('Event tracked:', eventName, properties);
    
    // Google Analytics 4 integration example
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, properties);
    }
    
    // Mixpanel integration example
    if (typeof mixpanel !== 'undefined') {
        mixpanel.track(eventName, properties);
    }
    
    // Custom analytics endpoint (replace with your analytics service)
    if (typeof fetch !== 'undefined') {
        fetch('/api/analytics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event: eventName,
                properties: properties,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            })
        }).catch(error => {
            console.warn('Analytics tracking failed:', error);
        });
    }
}

/**
 * Initialize keyboard navigation support
 * Handles keyboard interactions for accessibility
 * @function initializeKeyboardNavigation
 * @returns {void}
 */
function initializeKeyboardNavigation() {
    document.addEventListener('keydown', function(e) {
        // Enter key on phone input should trigger signup
        if (e.key === 'Enter' && e.target.type === 'tel') {
            e.preventDefault();
            startWhatsAppSignup();
        }
        
        // Escape key to close notifications
        if (e.key === 'Escape') {
            const notification = document.querySelector('.notification');
            if (notification) {
                notification.remove();
            }
        }
    });
}

/**
 * Initialize lazy loading for images
 * Loads images only when they enter the viewport
 * @function initializeLazyLoading
 * @returns {void}
 */
function initializeLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    if (images.length === 0) return;
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px 0px',
        threshold: 0.01
    });

    images.forEach(img => {
        img.classList.add('lazy');
        imageObserver.observe(img);
    });
}

/**
 * Performance optimization: Debounce function
 * Limits the rate at which a function can fire
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @returns {Function} - The debounced function
 */
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

/**
 * Performance optimization: Throttle function
 * Ensures a function is called at most once per specified time period
 * @param {Function} func - The function to throttle
 * @param {number} limit - The time limit in milliseconds
 * @returns {Function} - The throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Initialize additional features
document.addEventListener('DOMContentLoaded', function() {
    initializeKeyboardNavigation();
    initializeLazyLoading();
    
    // Add ripple animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(2);
                opacity: 0;
            }
        }
        .lazy {
            opacity: 0;
            transition: opacity 0.3s;
        }
        .loaded {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);
});

// Apply performance optimizations
const debouncedScrollHandler = debounce(function() {
    // Any scroll-based functionality can go here
}, 10);

const throttledResizeHandler = throttle(function() {
    // Any resize-based functionality can go here
}, 100);

window.addEventListener('scroll', debouncedScrollHandler, { passive: true });
window.addEventListener('resize', throttledResizeHandler, { passive: true });
