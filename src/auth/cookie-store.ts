/**
 * Cookie Store for NotebookLM MCP Server
 *
 * Provides a shared cookie management layer that can be used by both
 * the browser automation (Patchright) and the API client.
 *
 * Features:
 * - Load cookies from browser state file
 * - Export cookies in API-compatible format
 * - Cookie validation and expiry checking
 * - Automatic refresh when possible
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { Cookie } from '../api/types.js';
import { CONFIG } from '../config.js';
import { log } from '../utils/logger.js';

/**
 * Browser storage state format (from Playwright/Patchright)
 */
interface BrowserStorageState {
  cookies: BrowserCookie[];
  origins?: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

/**
 * Browser cookie format (from Playwright/Patchright)
 */
interface BrowserCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

/**
 * Cookie names that are critical for authentication
 */
const CRITICAL_COOKIES = [
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
];

/**
 * Cookie Store Manager
 *
 * Manages loading, caching, and exporting cookies for both
 * browser automation and API access.
 */
export class CookieStore {
  private stateFilePath: string;
  private cachedCookies: Cookie[] | null = null;
  private lastLoadTime = 0;

  /** Cache validity duration (5 minutes) */
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(stateFilePath?: string) {
    this.stateFilePath =
      stateFilePath || path.join(CONFIG.browserStateDir, 'state.json');
  }

  /**
   * Load cookies from the browser state file
   *
   * @param forceRefresh - Force reload even if cache is valid
   * @returns Array of cookies or empty array if not found
   */
  async loadCookies(forceRefresh = false): Promise<Cookie[]> {
    const now = Date.now();

    // Return cached cookies if still valid
    if (
      !forceRefresh &&
      this.cachedCookies &&
      now - this.lastLoadTime < this.CACHE_TTL_MS
    ) {
      return this.cachedCookies;
    }

    try {
      // Check if state file exists
      if (!existsSync(this.stateFilePath)) {
        log.warning('⚠️  No browser state file found. Please run setup_auth first.');
        return [];
      }

      // Read and parse state file
      const stateData = await fs.readFile(this.stateFilePath, 'utf-8');
      const state: BrowserStorageState = JSON.parse(stateData);

      if (!state.cookies || !Array.isArray(state.cookies)) {
        log.warning('⚠️  No cookies found in state file');
        return [];
      }

      // Convert to API-compatible format
      const cookies: Cookie[] = state.cookies.map((bc) => ({
        name: bc.name,
        value: bc.value,
        domain: bc.domain,
        path: bc.path,
        expires: bc.expires,
        httpOnly: bc.httpOnly,
        secure: bc.secure,
        sameSite: bc.sameSite,
      }));

      // Update cache
      this.cachedCookies = cookies;
      this.lastLoadTime = now;

      log.success(`✅ Loaded ${cookies.length} cookies from state file`);
      return cookies;
    } catch (error) {
      log.error(`❌ Failed to load cookies: ${error}`);
      return [];
    }
  }

  /**
   * Get Google-domain cookies only
   */
  async getGoogleCookies(): Promise<Cookie[]> {
    const cookies = await this.loadCookies();
    return cookies.filter((c) => c.domain.includes('google.com'));
  }

  /**
   * Get NotebookLM-specific cookies only
   */
  async getNotebookLMCookies(): Promise<Cookie[]> {
    const cookies = await this.loadCookies();
    return cookies.filter(
      (c) =>
        c.domain.includes('notebooklm.google.com') ||
        c.domain.includes('.google.com')
    );
  }

  /**
   * Get critical authentication cookies
   */
  async getCriticalCookies(): Promise<Cookie[]> {
    const cookies = await this.loadCookies();
    return cookies.filter((c) => CRITICAL_COOKIES.includes(c.name));
  }

  /**
   * Check if we have all required cookies for authentication
   */
  async hasValidAuth(): Promise<boolean> {
    const cookies = await this.loadCookies();

    // Check for minimum required cookies
    const required = ['SID', 'HSID', 'SSID'];
    const hasRequired = required.every((name) =>
      cookies.some((c) => c.name === name)
    );

    if (!hasRequired) {
      return false;
    }

    // Check for at least one PSID cookie
    const hasPSID = cookies.some(
      (c) =>
        c.name === '__Secure-1PSID' ||
        c.name === '__Secure-3PSID' ||
        c.name === 'OSID' ||
        c.name === '__Secure-OSID'
    );

    return hasPSID;
  }

  /**
   * Check if any critical cookies are expired
   */
  async hasExpiredCookies(): Promise<string[]> {
    const cookies = await this.loadCookies();
    const now = Date.now() / 1000;
    const expired: string[] = [];

    for (const cookie of cookies) {
      if (CRITICAL_COOKIES.includes(cookie.name)) {
        // -1 means session cookie (valid until browser closes)
        if (cookie.expires && cookie.expires !== -1 && cookie.expires < now) {
          expired.push(cookie.name);
        }
      }
    }

    return expired;
  }

  /**
   * Get cookie value by name
   */
  async getCookieValue(name: string): Promise<string | null> {
    const cookies = await this.loadCookies();
    const cookie = cookies.find((c) => c.name === name);
    return cookie?.value || null;
  }

  /**
   * Get SAPISID cookie (needed for API authorization)
   */
  async getSAPISID(): Promise<string | null> {
    const cookies = await this.loadCookies();

    // Try multiple cookie names
    const sapisidCookie = cookies.find(
      (c) => c.name === 'SAPISID' || c.name === '__Secure-3PAPISID'
    );

    return sapisidCookie?.value || null;
  }

  /**
   * Clear the cookie cache
   */
  clearCache(): void {
    this.cachedCookies = null;
    this.lastLoadTime = 0;
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): {
    cached: boolean;
    count: number;
    age: number | null;
  } {
    return {
      cached: this.cachedCookies !== null,
      count: this.cachedCookies?.length || 0,
      age: this.lastLoadTime
        ? Math.floor((Date.now() - this.lastLoadTime) / 1000)
        : null,
    };
  }

  /**
   * Build cookie header string for HTTP requests
   */
  async buildCookieHeader(): Promise<string> {
    const cookies = await this.loadCookies();
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }

  /**
   * Update cookies from browser context
   *
   * This should be called after browser operations to ensure
   * the cookie store stays in sync.
   *
   * @param browserCookies - Cookies from browser context
   */
  updateFromBrowser(browserCookies: BrowserCookie[]): void {
    this.cachedCookies = browserCookies.map((bc) => ({
      name: bc.name,
      value: bc.value,
      domain: bc.domain,
      path: bc.path,
      expires: bc.expires,
      httpOnly: bc.httpOnly,
      secure: bc.secure,
      sameSite: bc.sameSite,
    }));
    this.lastLoadTime = Date.now();
  }

  /**
   * Get summary of authentication status
   */
  async getAuthSummary(): Promise<{
    valid: boolean;
    cookieCount: number;
    criticalCount: number;
    expiredCount: number;
    message: string;
  }> {
    const cookies = await this.loadCookies();
    const critical = await this.getCriticalCookies();
    const expired = await this.hasExpiredCookies();
    const valid = await this.hasValidAuth();

    let message: string;
    if (!valid) {
      if (cookies.length === 0) {
        message = 'No cookies found. Run setup_auth to authenticate.';
      } else if (critical.length === 0) {
        message = 'Missing critical authentication cookies.';
      } else {
        message = 'Authentication incomplete. Re-run setup_auth.';
      }
    } else if (expired.length > 0) {
      message = `Some cookies expired: ${expired.join(', ')}`;
    } else {
      message = 'Authentication valid.';
    }

    return {
      valid,
      cookieCount: cookies.length,
      criticalCount: critical.length,
      expiredCount: expired.length,
      message,
    };
  }
}

// Export singleton instance
export const cookieStore = new CookieStore();

/**
 * Initialize the API client with cookies from the store
 *
 * @param client - The API client to initialize
 */
export async function initializeAPIClientWithCookies(
  client: { setCookies: (cookies: Cookie[]) => void }
): Promise<boolean> {
  const allCookies = await cookieStore.loadCookies();

  if (allCookies.length === 0) {
    log.warning('⚠️  No cookies available for API client');
    return false;
  }

  // Filter to .google.com and notebooklm domains only — avoid duplicates
  // from youtube.com, google.com.vn etc. that cause 401 errors
  const cookies = allCookies.filter(c =>
    c.domain === '.google.com' ||
    c.domain === 'notebooklm.google.com' ||
    c.domain === '.notebooklm.google.com' ||
    c.domain === 'accounts.google.com' ||
    c.domain === '.accounts.google.com'
  );

  client.setCookies(cookies);

  const summary = await cookieStore.getAuthSummary();
  if (!summary.valid) {
    log.warning(`⚠️  ${summary.message}`);
    return false;
  }

  return true;
}
