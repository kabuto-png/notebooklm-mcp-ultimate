/**
 * CSRF Token Manager for NotebookLM API
 *
 * Google's batchexecute endpoint requires CSRF protection via:
 * 1. A hash derived from SAPISID cookie (authorization header)
 * 2. A token extracted from the page (for some operations)
 *
 * This manager handles:
 * - SAPISIDHASH generation from cookies
 * - CSRF token extraction and caching
 * - Token refresh when expired
 */

import crypto from 'crypto';
import type { Cookie } from './types.js';

/**
 * CSRF token with metadata
 */
interface CSRFToken {
  /** The token value */
  value: string;
  /** When the token was extracted */
  extractedAt: number;
  /** Token expiry time (estimated) */
  expiresAt: number;
}

/**
 * CSRF Manager for NotebookLM API authentication
 */
export class CSRFManager {
  private cachedToken: CSRFToken | null = null;

  /** Token validity duration (15 minutes) */
  private readonly TOKEN_TTL_MS = 15 * 60 * 1000;

  /** Origin for SAPISIDHASH calculation */
  private readonly ORIGIN = 'https://notebooklm.google.com';

  /**
   * Generate SAPISIDHASH for Authorization header
   *
   * The hash is calculated as:
   * SAPISIDHASH <timestamp>_<sha1(timestamp + " " + SAPISID + " " + origin)>
   *
   * @param cookies - Browser cookies containing SAPISID
   * @returns Authorization header value or null if SAPISID not found
   */
  generateSAPISIDHash(cookies: Cookie[]): string | null {
    // Find SAPISID cookie
    const sapisidCookie = cookies.find(
      (c) => c.name === 'SAPISID' || c.name === '__Secure-3PAPISID'
    );

    if (!sapisidCookie) {
      return null;
    }

    const sapisid = sapisidCookie.value;
    const timestamp = Math.floor(Date.now() / 1000);
    const input = `${timestamp} ${sapisid} ${this.ORIGIN}`;

    // Calculate SHA1 hash
    const hash = crypto.createHash('sha1').update(input).digest('hex');

    return `SAPISIDHASH ${timestamp}_${hash}`;
  }

  /**
   * Extract CSRF token from page HTML
   *
   * The token is embedded in the page as a JavaScript variable.
   * Common patterns:
   * - window.WIZ_global_data.SNlM0e = "token"
   * - "SNlM0e":"token"
   *
   * @param html - Page HTML content
   * @returns Extracted token or null if not found
   */
  extractTokenFromHTML(html: string): string | null {
    // Try multiple patterns
    const patterns = [
      // WIZ_global_data pattern
      /window\.WIZ_global_data\s*=\s*\{[^}]*"SNlM0e"\s*:\s*"([^"]+)"/,
      // Direct JSON pattern
      /"SNlM0e"\s*:\s*"([^"]+)"/,
      // Alternative patterns
      /SNlM0e\s*=\s*["']([^"']+)["']/,
      /\\"SNlM0e\\":\\"([^\\]+)\\"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Get cached CSRF token if still valid
   *
   * @returns Cached token value or null if expired/missing
   */
  getCachedToken(): string | null {
    if (!this.cachedToken) {
      return null;
    }

    const now = Date.now();
    if (now >= this.cachedToken.expiresAt) {
      this.cachedToken = null;
      return null;
    }

    return this.cachedToken.value;
  }

  /**
   * Set/update cached CSRF token
   *
   * @param token - The token value to cache
   */
  setCachedToken(token: string): void {
    const now = Date.now();
    this.cachedToken = {
      value: token,
      extractedAt: now,
      expiresAt: now + this.TOKEN_TTL_MS,
    };
  }

  /**
   * Clear cached token (e.g., after auth failure)
   */
  clearCache(): void {
    this.cachedToken = null;
  }

  /**
   * Check if we have a valid cached token
   */
  hasValidToken(): boolean {
    return this.getCachedToken() !== null;
  }

  /**
   * Get token age in seconds (for debugging)
   */
  getTokenAge(): number | null {
    if (!this.cachedToken) {
      return null;
    }
    return Math.floor((Date.now() - this.cachedToken.extractedAt) / 1000);
  }

  /**
   * Build required cookies header value from cookie array
   *
   * @param cookies - Array of cookies
   * @returns Cookie header value string
   */
  buildCookieHeader(cookies: Cookie[]): string {
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }

  /**
   * Get essential cookies for API requests
   *
   * These are the minimum cookies required for authentication.
   *
   * @param cookies - All browser cookies
   * @returns Filtered essential cookies
   */
  getEssentialCookies(cookies: Cookie[]): Cookie[] {
    const essentialNames = [
      'SID',
      'HSID',
      'SSID',
      'APISID',
      'SAPISID',
      'OSID',
      '__Secure-OSID',
      '__Secure-1PSID',
      '__Secure-1PAPISID',
      '__Secure-3PSID',
      '__Secure-3PAPISID',
      'NID',
    ];

    return cookies.filter((c) => essentialNames.includes(c.name));
  }

  /**
   * Validate that required cookies are present
   *
   * @param cookies - Cookies to validate
   * @returns True if all required cookies are present
   */
  hasRequiredCookies(cookies: Cookie[]): boolean {
    const required = ['SID', 'HSID', 'SSID'];

    // Also check for at least one PSID cookie
    const hasPSID = cookies.some(
      (c) =>
        c.name === '__Secure-1PSID' ||
        c.name === '__Secure-3PSID' ||
        c.name === 'OSID' ||
        c.name === '__Secure-OSID'
    );

    const hasRequired = required.every((name) =>
      cookies.some((c) => c.name === name)
    );

    return hasRequired && hasPSID;
  }
}

// Export singleton instance
export const csrfManager = new CSRFManager();
