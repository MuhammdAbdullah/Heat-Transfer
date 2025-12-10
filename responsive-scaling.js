// Simple Responsive Scaling System for Electron App
// This file makes everything scale proportionally when window resizes

// Store the original window size
let baseWidth = 1200;
let baseHeight = 800;
let isInitialized = false;

// Function to calculate the scaling factor
function calculateScaleFactor() {
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    const widthScale = currentWidth / baseWidth;
    const minScale = 0.5;
    const maxScale = 2.0;
    const scaleFactor = Math.max(minScale, Math.min(maxScale, widthScale));
    return scaleFactor;
}

// Function to apply scaling to the entire page
function applyResponsiveScaling() {
    const scaleFactor = calculateScaleFactor();
    const newFontSize = 16 * scaleFactor;
    document.documentElement.style.fontSize = newFontSize + 'px';
    document.documentElement.style.setProperty('--scale-factor', scaleFactor);
    
    console.log('[Responsive Scaling] Window: ' + window.innerWidth + 'x' + window.innerHeight + ' | Base: ' + baseWidth + 'x' + baseHeight + ' | Scale: ' + scaleFactor.toFixed(2) + ' | Font size: ' + newFontSize.toFixed(1) + 'px');
}

// Function to initialize the responsive scaling system
function initializeResponsiveScaling(customBaseWidth, customBaseHeight) {
    if (isInitialized) {
        console.log('[Responsive Scaling] Already initialized, skipping...');
        return;
    }
    
    if (customBaseWidth && customBaseWidth > 0) {
        baseWidth = customBaseWidth;
    }
    if (customBaseHeight && customBaseHeight > 0) {
        baseHeight = customBaseHeight;
    }
    
    console.log('[Responsive Scaling] Initializing with base: ' + baseWidth + ' x ' + baseHeight);
    
    applyResponsiveScaling();
    
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            applyResponsiveScaling();
        }, 100);
    });
    
    isInitialized = true;
    console.log('[Responsive Scaling] Initialized successfully');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            initializeResponsiveScaling(window.innerWidth, window.innerHeight);
        }, 100);
    });
} else {
    setTimeout(function() {
        initializeResponsiveScaling(window.innerWidth, window.innerHeight);
    }, 100);
}



