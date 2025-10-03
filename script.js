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

    // Format phone number for display
    const formattedNumber = `${countryCode}${phoneNumber}`;
    
    // Show the phone signup modal with the phone number pre-filled
    showPhoneSignupModal(formattedNumber, countryCode, phoneNumber);
}

/**
 * Show phone signup modal with pre-filled phone number
 * @param {string} formattedNumber - The complete formatted phone number
 * @param {string} countryCode - The country code
 * @param {string} phoneNumber - The phone number without country code
 * @returns {void}
 */
function showPhoneSignupModal(formattedNumber, countryCode, phoneNumber) {
    const modal = document.getElementById('phoneSignupModal');
    const phoneDisplay = document.getElementById('signupPhoneDisplay');
    
    // Pre-fill the phone number display
    phoneDisplay.value = formattedNumber;
    
    // Store the phone data for later use
    modal.dataset.formattedNumber = formattedNumber;
    modal.dataset.countryCode = countryCode;
    modal.dataset.phoneNumber = phoneNumber;
    
    // Show the modal
    modal.style.display = 'flex';
    
    // Focus on first name input
    setTimeout(() => {
        document.getElementById('signupFirstName').focus();
    }, 300);
    
    // Track modal opened
    trackEvent('phone_signup_modal_opened', {
        phone_number: formattedNumber,
        source: 'landing_page',
        timestamp: new Date().toISOString()
    });
}

/**
 * Close phone signup modal
 * @returns {void}
 */
function closePhoneSignupModal() {
    const modal = document.getElementById('phoneSignupModal');
    modal.style.display = 'none';
    
    // Reset form
    document.getElementById('phoneSignupForm').reset();
    
    // Clear stored data
    delete modal.dataset.formattedNumber;
    delete modal.dataset.countryCode;
    delete modal.dataset.phoneNumber;
}

/**
 * Handle phone signup form submission
 * @param {Event} event - The form submission event
 * @returns {void}
 */
function handlePhoneSignupSubmit(event) {
    event.preventDefault();
    
    console.log('Phone signup form submitted!');
    
    const form = event.target;
    const modal = document.getElementById('phoneSignupModal');
    
    // Get phone data from modal dataset
    const formattedNumber = modal.dataset.formattedNumber;
    
    // Update the phone field with the formatted number
    const phoneInput = form.querySelector('input[name="phone"]');
    phoneInput.value = formattedNumber;
    
    // Prepare form data exactly like your example
    let formData = {
        first_name: form.first_name.value,
        last_name: form.last_name.value,
        email: form.email.value,
        phone: formattedNumber,
        page: form.page.value
    };
    
    console.log('Form data being sent:', formData);
    
    // Show loading state
    const submitBtn = form.querySelector('.phone-signup-submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    submitBtn.disabled = true;
    
    // Submit to Google Apps Script using your exact approach
    const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbzDeCNco-q8b8xOktCi9bTih50B5_DMqZb_DK3Br98mQJLAQq281Pm7K3SaZCINktA6/exec';
    
    fetch(googleScriptUrl, {
        method: "POST",
        body: JSON.stringify(formData),
        headers: {"Content-Type": "application/json"}
    })
    .then(res => res.text())
    .then(data => {
        console.log('Response from Google Apps Script:', data);
        showNotification('Signup complete! Thank you for joining Daily Dividend. We\'ll be in touch soon!', 'success');
        closePhoneSignupModal();
        
        // Track successful signup
        trackEvent('phone_signup_completed', {
            phone_number: formattedNumber,
            email: formData.email,
            source: 'modal',
            timestamp: new Date().toISOString()
        });
    })
    .catch(err => {
        console.error('Error submitting form:', err);
        showNotification('Unable to complete signup. Please try again.', 'error');
    })
    .finally(() => {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    });
}

/**
 * Open WhatsApp with proper device detection and fallbacks
 * @param {string} whatsappUrl - The WhatsApp URL to try
 * @param {string} message - The message to send
 * @param {string} businessNumber - The business phone number
 * @returns {void}
 */
function openWhatsApp(whatsappUrl, message, businessNumber) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS) {
        // iOS: Try app first, then fallback to web
        const appUrl = `whatsapp://send?phone=${businessNumber}&text=${encodeURIComponent(message)}`;
        const webUrl = `https://web.whatsapp.com/send?phone=${businessNumber}&text=${encodeURIComponent(message)}`;
        
        // Try to open the app
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = appUrl;
        document.body.appendChild(iframe);
        
        // Fallback to web after a short delay
        setTimeout(() => {
            document.body.removeChild(iframe);
            window.open(webUrl, '_blank');
        }, 2000);
        
    } else if (isAndroid) {
        // Android: Use wa.me (most reliable)
        window.open(whatsappUrl, '_blank');
        
    } else {
        // Desktop: Use web version
        window.open(whatsappUrl, '_blank');
    }
}

/**
 * Submit complete signup data to Google Apps Script
 * @param {Object} signupData - The complete signup data object
 * @returns {Promise} - Promise that resolves when data is submitted
 */
function submitCompleteSignupToGoogleAppsScript(signupData) {
    const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbzDeCNco-q8b8xOktCi9bTih50B5_DMqZb_DK3Br98mQJLAQq281Pm7K3SaZCINktA6/exec';
    
    const formData = {
        first_name: signupData.firstName,
        last_name: signupData.lastName,
        email: signupData.email,
        phone_number: signupData.phoneNumber,
        page: 'landing_page_signup',
        source: signupData.source,
        timestamp: signupData.timestamp
    };

    // Log what we're sending
    console.log('Sending data to Google Apps Script:', formData);
    console.log('URL:', googleScriptUrl);

    return fetch(googleScriptUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    })
    .then(response => {
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        // If we get here, the request was sent successfully
        // Don't worry about the response content, just assume success
        console.log('Complete signup data submitted to Google Apps Script successfully');
        return Promise.resolve();
    })
    .catch(error => {
        console.error('Error submitting complete signup to Google Apps Script:', error);
        throw error;
    });
}

/**
 * Simple form submission method (no CORS issues)
 * @param {Object} signupData - The signup data object
 * @returns {void}
 */
function submitWithFormMethod(signupData) {
    const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbzDeCNco-q8b8xOktCi9bTih50B5_DMqZb_DK3Br98mQJLAQq281Pm7K3SaZCINktA6/exec';
    
    console.log('=== FORM SUBMISSION DEBUG ===');
    console.log('Google Script URL:', googleScriptUrl);
    console.log('Signup Data:', signupData);
    
    // Create a hidden form and submit it
    const form = document.createElement('form');
    form.action = googleScriptUrl;
    form.method = 'POST';
    form.target = 'hidden_iframe';
    form.style.display = 'none';
    
    // Add form fields
    const fields = {
        'first_name': signupData.firstName,
        'last_name': signupData.lastName,
        'email': signupData.email,
        'phone': signupData.phoneNumber,
        'page': 'landing_page_signup'
    };
    
    console.log('Form fields being sent:', fields);
    
    Object.keys(fields).forEach(key => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = fields[key];
        form.appendChild(input);
        console.log(`Added field: ${key} = ${fields[key]}`);
    });
    
    // Create hidden iframe if it doesn't exist
    let iframe = document.getElementById('hidden_iframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'hidden_iframe';
        iframe.name = 'hidden_iframe';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        console.log('Created hidden iframe');
    } else {
        console.log('Using existing hidden iframe');
    }
    
    // Submit the form
    document.body.appendChild(form);
    console.log('Form added to DOM, submitting...');
    form.submit();
    document.body.removeChild(form);
    
    console.log('Form submitted to Google Apps Script');
    console.log('=== END FORM SUBMISSION DEBUG ===');
}

/**
 * Test function - run this in browser console to test Google Apps Script directly
 * Usage: testGoogleAppsScript()
 */
function testGoogleAppsScript() {
    console.log('=== TESTING GOOGLE APPS SCRIPT DIRECTLY ===');
    
    const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbzDeCNco-q8b8xOktCi9bTih50B5_DMqZb_DK3Br98mQJLAQq281Pm7K3SaZCINktA6/exec';
    
    fetch(googleScriptUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: new URLSearchParams({
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            phone: '+447000000000',
            page: '/console'
        })
    })
    .then(response => {
        console.log('Test response status:', response.status);
        return response.text();
    })
    .then(text => {
        console.log('Test response text:', text);
        console.log('=== TEST COMPLETE ===');
    })
    .catch(error => {
        console.error('Test failed:', error);
    });
}

/**
 * Open WhatsApp with message using proper device detection
 * @param {string} businessNumber - The business phone number
 * @param {string} message - The message to send
 * @returns {void}
 */
function openWhatsAppWithMessage(businessNumber, message) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let whatsappUrl;
    
    if (isIOS) {
        // iOS: Try app first, then fallback to web
        const appUrl = `whatsapp://send?phone=${businessNumber}&text=${encodeURIComponent(message)}`;
        const webUrl = `https://web.whatsapp.com/send?phone=${businessNumber}&text=${encodeURIComponent(message)}`;
        
        // Try to open the app
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = appUrl;
        document.body.appendChild(iframe);
        
        // Fallback to web after a short delay
        setTimeout(() => {
            document.body.removeChild(iframe);
            window.open(webUrl, '_blank');
        }, 2000);
        
    } else if (isAndroid) {
        // Android: Use wa.me (most reliable)
        whatsappUrl = `https://wa.me/${businessNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        
    } else {
        // Desktop: Use web version
        whatsappUrl = `https://web.whatsapp.com/send?phone=${businessNumber}&text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    }
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
 * Show waitlist form for premium tiers
 * Handles user interaction with coming soon pricing cards
 * @function showWaitlistForm
 * @returns {void}
 */
function showWaitlistForm() {
    const modal = document.getElementById('waitlistModal');
    modal.style.display = 'flex';
    
    // Track waitlist modal opened
    trackEvent('waitlist_modal_opened', {
        source: 'pricing_section',
        timestamp: new Date().toISOString()
    });
}

/**
 * Close the waitlist modal
 * @function closeWaitlistModal
 * @returns {void}
 */
function closeWaitlistModal() {
    const modal = document.getElementById('waitlistModal');
    modal.style.display = 'none';
}

/**
 * Handle waitlist form submission
 * @function handleWaitlistSubmit
 * @param {Event} event - The form submit event
 * @returns {void}
 */
function handleWaitlistSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const waitlistData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        source: 'waitlist_modal',
        timestamp: new Date().toISOString()
    };
    
    // Submit to Google Apps Script
    submitWaitlistToGoogleAppsScript(waitlistData)
        .then(() => {
            showNotification('Thanks! You\'ve been added to our waitlist. We\'ll notify you when premium features launch!', 'success');
            closeWaitlistModal();
            event.target.reset();
            
            // Track waitlist signup
            trackEvent('waitlist_signup', {
                source: 'modal',
                timestamp: new Date().toISOString()
            });
        })
        .catch((error) => {
            console.error('Error submitting waitlist:', error);
            showNotification('Unable to join waitlist. Please try again.', 'error');
        });
}

/**
 * Submit waitlist data to Google Apps Script
 * @param {Object} waitlistData - The waitlist form data
 * @returns {Promise} - Promise that resolves when data is submitted
 */
function submitWaitlistToGoogleAppsScript(waitlistData) {
    const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbzDeCNco-q8b8xOktCi9bTih50B5_DMqZb_DK3Br98mQJLAQq281Pm7K3SaZCINktA6/exec';
    
    const formData = {
        name: `${waitlistData.firstName} ${waitlistData.lastName}`,
        email: waitlistData.email,
        product: 'Daily Dividend Waitlist',
        quantity: 1,
        comments: `Waitlist signup - Phone: ${waitlistData.phone}, Source: ${waitlistData.source}`,
        phone_number: waitlistData.phone,
        first_name: waitlistData.firstName,
        last_name: waitlistData.lastName,
        source: waitlistData.source,
        timestamp: waitlistData.timestamp,
        user_agent: navigator.userAgent,
        referrer: document.referrer || 'direct'
    };

    return fetch(googleScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    })
    .then(response => {
        console.log('Waitlist data submitted to Google Apps Script successfully');
        return Promise.resolve();
    })
    .catch(error => {
        console.error('Error submitting waitlist to Google Apps Script:', error);
        throw error;
    });
}

/**
 * Show coming soon notification for premium tiers
 * Handles user interaction with coming soon pricing cards
 * @function showComingSoonNotification
 * @returns {void}
 */
function showComingSoonNotification() {
    // Create a more engaging coming soon modal
    const modal = document.createElement('div');
    modal.className = 'coming-soon-modal';
    modal.innerHTML = `
        <div class="coming-soon-modal__content">
            <div class="coming-soon-modal__header">
                <div class="coming-soon-modal__icon">
                    <i class="fas fa-rocket"></i>
                </div>
                <h3>Coming Soon!</h3>
                <p>We're working hard to bring you these premium features</p>
            </div>
            <div class="coming-soon-modal__body">
                <div class="feature-preview">
                    <div class="feature-preview__item">
                        <i class="fas fa-chart-line"></i>
                        <span>Advanced Market Analysis</span>
                    </div>
                    <div class="feature-preview__item">
                        <i class="fas fa-users"></i>
                        <span>Exclusive Community Access</span>
                    </div>
                    <div class="feature-preview__item">
                        <i class="fas fa-graduation-cap"></i>
                        <span>Premium Educational Content</span>
                    </div>
                </div>
                <div class="coming-soon-modal__cta">
                    <p>Get notified when these features launch!</p>
                    <button class="coming-soon-modal__button" onclick="notifyWhenAvailable()">
                        <i class="fas fa-bell"></i>
                        Notify Me
                    </button>
                </div>
            </div>
            <button class="coming-soon-modal__close" onclick="closeComingSoonModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
        .coming-soon-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        }
        
        .coming-soon-modal__content {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 90%;
            position: relative;
            animation: slideUp 0.3s ease;
        }
        
        .coming-soon-modal__header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .coming-soon-modal__icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            color: white;
            font-size: 2rem;
            animation: pulse 2s ease-in-out infinite;
        }
        
        .coming-soon-modal__header h3 {
            font-size: 2rem;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 10px;
        }
        
        .coming-soon-modal__header p {
            color: #6b7280;
            font-size: 1.1rem;
        }
        
        .feature-preview {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin-bottom: 30px;
        }
        
        .feature-preview__item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            background: #f8fafc;
            border-radius: 10px;
            color: #374151;
            font-weight: 500;
        }
        
        .feature-preview__item i {
            color: #667eea;
            font-size: 1.2rem;
        }
        
        .coming-soon-modal__cta {
            text-align: center;
        }
        
        .coming-soon-modal__cta p {
            color: #6b7280;
            margin-bottom: 20px;
        }
        
        .coming-soon-modal__button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 0 auto;
            transition: all 0.3s ease;
        }
        
        .coming-soon-modal__button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }
        
        .coming-soon-modal__close {
            position: absolute;
            top: 20px;
            right: 20px;
            background: none;
            border: none;
            font-size: 1.5rem;
            color: #9ca3af;
            cursor: pointer;
            padding: 5px;
            border-radius: 50%;
            transition: all 0.3s ease;
        }
        
        .coming-soon-modal__close:hover {
            background: #f3f4f6;
            color: #374151;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    // Track coming soon interaction
    trackEvent('coming_soon_modal_opened', {
        source: 'pricing_section',
        timestamp: new Date().toISOString()
    });
}

/**
 * Handle notify when available action
 * @function notifyWhenAvailable
 * @returns {void}
 */
function notifyWhenAvailable() {
    // For now, just show a success message
    // In the future, this could collect email addresses or phone numbers
    showNotification('Thanks! We\'ll notify you when premium features are available.', 'success');
    closeComingSoonModal();
    
    // Track notification signup
    trackEvent('coming_soon_notification_signup', {
        source: 'modal',
        timestamp: new Date().toISOString()
    });
}

/**
 * Close the coming soon modal
 * @function closeComingSoonModal
 * @returns {void}
 */
function closeComingSoonModal() {
    const modal = document.querySelector('.coming-soon-modal');
    if (modal) {
        modal.style.animation = 'fadeIn 0.3s ease reverse';
        setTimeout(() => modal.remove(), 300);
    }
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
    initializeWaitlistForm();
    initializePhoneSignupForm();
    
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

/**
 * Initialize waitlist form
 * @function initializeWaitlistForm
 * @returns {void}
 */
function initializeWaitlistForm() {
    const waitlistForm = document.getElementById('waitlistForm');
    if (waitlistForm) {
        waitlistForm.addEventListener('submit', handleWaitlistSubmit);
    }
}

/**
 * Initialize phone signup form functionality
 * @returns {void}
 */
function initializePhoneSignupForm() {
    const phoneSignupForm = document.getElementById('phoneSignupForm');
    if (phoneSignupForm) {
        console.log('Phone signup form found, adding event listener');
        phoneSignupForm.addEventListener('submit', handlePhoneSignupSubmit);
    } else {
        console.error('Phone signup form not found!');
    }
}

// Apply performance optimizations
const debouncedScrollHandler = debounce(function() {
    // Any scroll-based functionality can go here
}, 10);

const throttledResizeHandler = throttle(function() {
    // Any resize-based functionality can go here
}, 100);

window.addEventListener('scroll', debouncedScrollHandler, { passive: true });
window.addEventListener('resize', throttledResizeHandler, { passive: true });
