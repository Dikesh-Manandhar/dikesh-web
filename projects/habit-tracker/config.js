/**
 * Configuration file for API URL
 * This file handles environment-specific API URLs
 */

const getApiUrl = () => {
    // Check if running in browser environment
    if (typeof window === 'undefined') {
        // Node.js environment
        return process.env.API_URL || `http://localhost:${process.env.PORT || 3000}/api`;
    }

    // Browser environment
    // 1. Check for environment variable (if built with build tool that supports it)
    if (typeof VITE_API_URL !== 'undefined') {
        return VITE_API_URL;
    }

    // 2. Check browser's sessionStorage/localStorage (can be set by user)
    const storedApiUrl = sessionStorage.getItem('API_URL') || localStorage.getItem('API_URL');
    if (storedApiUrl) {
        return storedApiUrl;
    }

    // 3. Auto-detect based on current location
    const protocol = window.location.protocol; // 'https:' or 'http:'
    const hostname = window.location.hostname; // 'localhost', 'dikeshmanandhar.com.np', etc.
    
    // Development environment detection
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://${hostname}:3000/api`;
    }

    // 4. Production: Use same protocol and domain, with /api path
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${protocol}//${hostname}${port}/api`;
};

const API_URL = getApiUrl();

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_URL, getApiUrl };
}
