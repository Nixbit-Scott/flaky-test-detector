// Utility functions for UTM parameter tracking

export interface UTMParameters {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  [key: string]: string | undefined;
}

/**
 * Extract UTM parameters from URL search params
 */
export function extractUTMParameters(): UTMParameters {
  if (typeof window === 'undefined') {
    return {};
  }

  const urlParams = new URLSearchParams(window.location.search);
  const utmParams: UTMParameters = {};

  // Standard UTM parameters
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  
  utmKeys.forEach(key => {
    const value = urlParams.get(key);
    if (value) {
      utmParams[key] = value;
    }
  });

  // Also capture any other parameters that might be useful
  const additionalParams = ['ref', 'referrer', 'gclid', 'fbclid'];
  additionalParams.forEach(key => {
    const value = urlParams.get(key);
    if (value) {
      utmParams[key] = value;
    }
  });

  return utmParams;
}

/**
 * Store UTM parameters in sessionStorage for persistence across pages
 */
export function storeUTMParameters(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const utmParams = extractUTMParameters();
  
  if (Object.keys(utmParams).length > 0) {
    sessionStorage.setItem('utm_parameters', JSON.stringify(utmParams));
  }
}

/**
 * Get stored UTM parameters from sessionStorage
 */
export function getStoredUTMParameters(): UTMParameters {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = sessionStorage.getItem('utm_parameters');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error parsing stored UTM parameters:', error);
    return {};
  }
}

/**
 * Determine the traffic source based on referrer and UTM parameters
 */
export function determineTrafficSource(): string {
  const utmParams = getStoredUTMParameters();
  
  // If we have UTM source, use that
  if (utmParams.utm_source) {
    return utmParams.utm_source;
  }

  // Check referrer
  if (typeof window !== 'undefined' && document.referrer) {
    const referrer = new URL(document.referrer);
    const hostname = referrer.hostname.toLowerCase();

    // Common traffic sources
    if (hostname.includes('google')) {
      return 'google';
    } else if (hostname.includes('facebook')) {
      return 'facebook';
    } else if (hostname.includes('twitter')) {
      return 'twitter';
    } else if (hostname.includes('linkedin')) {
      return 'linkedin';
    } else if (hostname.includes('github')) {
      return 'github';
    } else if (hostname.includes('ycombinator') || hostname.includes('news.ycombinator')) {
      return 'hackernews';
    } else if (hostname.includes('reddit')) {
      return 'reddit';
    } else if (hostname.includes('producthunt')) {
      return 'producthunt';
    } else {
      return 'referral';
    }
  }

  // Direct traffic
  return 'direct';
}

/**
 * Initialize UTM tracking on page load
 */
export function initializeUTMTracking(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Store UTM parameters if they exist in URL
  storeUTMParameters();
}