/**
 * Browser Session
 *
 * Represents a single browser session for NotebookLM interactions.
 *
 * Features:
 * - Human-like question typing
 * - Streaming response detection
 * - Auto-login on session expiry
 * - Session activity tracking
 * - Chat history reset
 *
 * Based on the Python implementation from browser_session.py
 */

import type { BrowserContext, Page } from "patchright";
import { SharedContextManager } from "./shared-context-manager.js";
import { AuthManager } from "../auth/auth-manager.js";
import { humanType, randomDelay } from "../utils/stealth-utils.js";
import {
  waitForLatestAnswer,
  snapshotAllResponses,
  extractCSRFFromPage,
} from "../utils/page-utils.js";
import { csrfManager } from "../api/csrf-manager.js";
import { CONFIG } from "../config.js";
import { log } from "../utils/logger.js";
import type { SessionInfo, ProgressCallback } from "../types.js";
import { RateLimitError } from "../errors.js";

export class BrowserSession {
  public readonly sessionId: string;
  public readonly notebookUrl: string;
  public readonly createdAt: number;
  public lastActivity: number;
  public messageCount: number;

  private context!: BrowserContext;
  private sharedContextManager: SharedContextManager;
  private authManager: AuthManager;
  private page: Page | null = null;
  private initialized: boolean = false;
  private isClosing = false;

  constructor(
    sessionId: string,
    sharedContextManager: SharedContextManager,
    authManager: AuthManager,
    notebookUrl: string
  ) {
    this.sessionId = sessionId;
    this.sharedContextManager = sharedContextManager;
    this.authManager = authManager;
    this.notebookUrl = notebookUrl;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.messageCount = 0;

    log.info(`🆕 BrowserSession ${sessionId} created`);
  }

  /**
   * Initialize the session by creating a page and navigating to the notebook
   */
  async init(): Promise<void> {
    if (this.initialized) {
      log.warning(`⚠️  Session ${this.sessionId} already initialized`);
      return;
    }

    log.info(`🚀 Initializing session ${this.sessionId}...`);

    try {
      // Ensure a valid shared context
      this.context = await this.sharedContextManager.getOrCreateContext();

      // Create new page (tab) in the shared context (with auto-recovery)
      try {
        this.page = await this.context.newPage();
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (/has been closed|Target .* closed|Browser has been closed|Context .* closed/i.test(msg)) {
          log.warning("  ♻️  Context was closed. Recreating and retrying newPage...");
          this.context = await this.sharedContextManager.getOrCreateContext();
          this.page = await this.context.newPage();
        } else {
          throw e;
        }
      }
      log.success(`  ✅ Created new page`);

      // Set iPad Mini viewport for NotebookLM responsive UI
      await this.page.setViewportSize({ width: 768, height: 1024 });

      // Navigate to notebook
      log.info(`  🌐 Navigating to: ${this.notebookUrl}`);
      await this.page.goto(this.notebookUrl, {
        waitUntil: "domcontentloaded",
        timeout: CONFIG.browserTimeout,
      });

      // Wait for Angular to finish rendering (use load instead of networkidle to avoid timeout)
      await this.page.waitForLoadState('load').catch(() => {});
      await randomDelay(2000, 3000);

      // Check if we need to login
      const isAuthenticated = await this.authManager.validateCookiesExpiry(
        this.context
      );

      if (!isAuthenticated) {
        log.warning(`  🔑 Session ${this.sessionId} needs authentication`);
        const loginSuccess = await this.ensureAuthenticated();
        if (!loginSuccess) {
          throw new Error("Failed to authenticate session");
        }
      } else {
        log.success(`  ✅ Session already authenticated`);
      }

      // CRITICAL: Restore sessionStorage from saved state
      // This is essential for maintaining Google session state!
      log.info(`  🔄 Restoring sessionStorage...`);
      const sessionData = await this.authManager.loadSessionStorage();
      if (sessionData) {
        const entryCount = Object.keys(sessionData).length;
        if (entryCount > 0) {
          await this.restoreSessionStorage(sessionData, entryCount);
        } else {
          log.info(`  ℹ️  SessionStorage empty (fresh session)`);
        }
      } else {
        log.info(`  ℹ️  No saved sessionStorage found (fresh session)`);
      }

      // Wait for NotebookLM interface to load
      log.info(`  ⏳ Waiting for NotebookLM interface...`);
      await this.waitForNotebookLMReady();

      // Extract CSRF token from browser and set on API client
      // This ensures API calls use the same session as the browser
      if (this.page) {
        const csrfToken = await extractCSRFFromPage(this.page);
        if (csrfToken) {
          csrfManager.setCachedToken(csrfToken);
          // Also save CSRF to disk for cold-start API usage
          await this.authManager.saveCSRFToken(csrfToken);
          log.success(`  🔑 CSRF token synced to API client`);
        }
      }

      this.initialized = true;
      this.updateActivity();
      log.success(`✅ Session ${this.sessionId} initialized successfully`);
    } catch (error) {
      log.error(`❌ Failed to initialize session ${this.sessionId}: ${error}`);
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      throw error;
    }
  }

  /**
   * Wait for NotebookLM interface to be ready
   *
   * IMPORTANT: Matches Python implementation EXACTLY!
   * - Uses SPECIFIC selectors (textarea.query-box-input)
   * - Checks ONLY for "visible" state (NOT disabled!)
   * - NO placeholder checks (let NotebookLM handle that!)
   *
   * Based on Python _wait_for_ready() from browser_session.py:104-113
   */
  private async waitForNotebookLMReady(): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    try {
      // PRIMARY: Exact Python selector - textarea.query-box-input
      log.info("  ⏳ Waiting for chat input (textarea.query-box-input)...");
      await this.page.waitForSelector("textarea.query-box-input", {
        timeout: 15000, // Extended for headless tests
        state: "visible", // ONLY check visibility (NO disabled check!)
      });
      log.success("  ✅ Chat input ready!");
    } catch {
      // Fix 5: Try multiple locale-agnostic fallback selectors instead of German-only
      const fallbackSelectors = [
        'textarea[aria-label="Query box"]',         // Exact aria-label (verified)
        'textarea[placeholder="Start typing..."]',  // Exact placeholder (verified)
        'textarea[placeholder*="Start typing"]',    // Partial match
        'textarea.mat-mdc-autocomplete-trigger',    // Material autocomplete
        'textarea[aria-label*="query"]',            // English partial
        'textarea[aria-label*="question"]',         // English
        'textarea[role="textbox"]',                 // Generic fallback
      ];

      let found = false;
      for (const sel of fallbackSelectors) {
        try {
          log.info(`  ⏳ Trying fallback selector: ${sel}...`);
          await this.page.waitForSelector(sel, { timeout: 3000, state: "visible" });
          log.success(`  ✅ Chat input ready (fallback: ${sel})!`);
          found = true;
          break;
        } catch {
          continue;
        }
      }

      if (!found) {
        log.error(`  ❌ NotebookLM interface not ready: all selectors exhausted`);
        throw new Error(
          "Could not find NotebookLM chat input. " +
          "Please ensure the notebook page has loaded correctly."
        );
      }
    }
  }

  private isPageClosedSafe(): boolean {
    if (!this.page) return true;
    const p: any = this.page as any;
    try {
      if (typeof p.isClosed === 'function') {
        if (p.isClosed()) return true;
      }
      // Accessing URL should be safe; if page is gone, this may throw
      void this.page.url();
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Ensure the session is authenticated, perform auto-login if needed
   */
  private async ensureAuthenticated(): Promise<boolean> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    log.info(`🔑 Checking authentication for session ${this.sessionId}...`);

    // Check cookie validity
    const isValid = await this.authManager.validateCookiesExpiry(this.context);

    if (isValid) {
      log.success(`  ✅ Cookies valid`);
      return true;
    }

    log.warning(`  ⚠️  Cookies expired or invalid`);

    // Try to get valid auth state
    const statePath = await this.authManager.getValidStatePath();

    if (statePath) {
      // Load saved state
      log.info(`  📂 Loading auth state from: ${statePath}`);
      await this.authManager.loadAuthState(this.context, statePath);

      // Reload page to apply new auth
      log.info(`  🔄 Reloading page...`);
      await (this.page as Page).reload({ waitUntil: "domcontentloaded" });
      await randomDelay(2000, 3000);

      // Check if it worked
      const nowValid = await this.authManager.validateCookiesExpiry(
        this.context
      );
      if (nowValid) {
        log.success(`  ✅ Auth state loaded successfully`);
        return true;
      }
    }

    // Need fresh login
    log.warning(`  🔑 Fresh login required`);

    if (CONFIG.autoLoginEnabled) {
      log.info(`  🤖 Attempting auto-login...`);
      const loginSuccess = await this.authManager.loginWithCredentials(
        this.context,
        this.page,
        CONFIG.loginEmail,
        CONFIG.loginPassword
      );

      if (loginSuccess) {
        log.success(`  ✅ Auto-login successful`);
        // Navigate back to notebook
        await this.page.goto(this.notebookUrl, {
          waitUntil: "domcontentloaded",
        });
        await randomDelay(2000, 3000);
        return true;
      } else {
        log.error(`  ❌ Auto-login failed`);
        return false;
      }
    } else {
      log.error(
        `  ❌ Auto-login disabled and no valid auth state - manual login required`
      );
      return false;
    }
  }

  private getOriginFromUrl(url: string): string | null {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  }

  /**
   * Safely restore sessionStorage when the page is on the expected origin
   */
  private async restoreSessionStorage(
    sessionData: Record<string, string>,
    entryCount: number
  ): Promise<void> {
    if (!this.page) {
      log.warning(`  ⚠️  Cannot restore sessionStorage without an active page`);
      return;
    }

    const targetOrigin = this.getOriginFromUrl(this.notebookUrl);
    if (!targetOrigin) {
      log.warning(`  ⚠️  Unable to determine target origin for sessionStorage restore`);
      return;
    }

    let restored = false;

    const applyToPage = async (): Promise<boolean> => {
      if (!this.page) {
        return false;
      }

      const currentOrigin = this.getOriginFromUrl(this.page.url());
      if (currentOrigin !== targetOrigin) {
        return false;
      }

      try {
        await this.page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            // @ts-expect-error - sessionStorage exists in browser context
            sessionStorage.setItem(key, value);
          }
        }, sessionData);
        restored = true;
        log.success(`  ✅ SessionStorage restored: ${entryCount} entries`);
        return true;
      } catch (error) {
        log.warning(`  ⚠️  Failed to restore sessionStorage: ${error}`);
        return false;
      }
    };

    if (await applyToPage()) {
      return;
    }

    log.info(`  ⏳ Waiting for NotebookLM origin before restoring sessionStorage...`);

    const handleNavigation = async () => {
      if (restored) {
        return;
      }

      if (await applyToPage()) {
        this.page?.off("framenavigated", handleNavigation);
        // Fix 6: Clear the safety timeout once we successfully restore
        clearTimeout(restoreTimeout);
      }
    };

    // Fix 6: Guard against a never-reached target origin leaking the framenavigated
    // listener indefinitely. Remove it after 30 seconds if not yet resolved.
    const restoreTimeout = setTimeout(() => {
      if (!restored && this.page) {
        this.page.off("framenavigated", handleNavigation);
        log.warning("  ⚠️  SessionStorage restore timed out after 30s — listener removed");
      }
    }, 30000);

    this.page.on("framenavigated", handleNavigation);
  }

  /**
   * Ask a question to NotebookLM
   */
  async ask(question: string, sendProgress?: ProgressCallback): Promise<string> {
    this.updateActivity(); // Heartbeat at start to prevent mid-ask eviction
    const askOnce = async (): Promise<string> => {
      if (!this.initialized || !this.page || this.isPageClosedSafe()) {
        log.warning(`  ℹ️  Session not initialized or page missing → re-initializing...`);
        await this.init();
      }

      log.info(`💬 [${this.sessionId}] Asking: "${question.substring(0, 100)}..."`);
      const page = this.page!;
      // Ensure we're still authenticated
      await sendProgress?.("Verifying authentication...", 2, 5);
      const isAuth = await this.authManager.validateCookiesExpiry(this.context);
      if (!isAuth) {
        log.warning(`  🔑 Session expired, re-authenticating...`);
        await sendProgress?.("Re-authenticating session...", 2, 5);
        const reAuthSuccess = await this.ensureAuthenticated();
        if (!reAuthSuccess) {
          throw new Error("Failed to re-authenticate session");
        }
      }

      // Snapshot existing responses BEFORE asking
      log.info(`  📸 Snapshotting existing responses...`);
      const existingResponses = await snapshotAllResponses(page);
      log.success(`  ✅ Captured ${existingResponses.length} existing responses`);

      // Find the chat input
      const inputSelector = await this.findChatInput();
      if (!inputSelector) {
        throw new Error(
          "Could not find visible chat input element. " +
          "Please check if the notebook page has loaded correctly."
        );
      }

      log.info(`  ⌨️  Typing question with human-like behavior...`);
      await sendProgress?.("Typing question with human-like behavior...", 2, 5);
      await humanType(page, inputSelector, question, {
        withTypos: true,
        // Fix 4: Randomize WPM between min and max for more human-like behaviour.
        // Previously always used Math.max(), which always returned the maximum.
        wpm: CONFIG.typingWpmMin + Math.floor(Math.random() * (CONFIG.typingWpmMax - CONFIG.typingWpmMin + 1)),
      });

      // Small pause before submitting
      await randomDelay(500, 1000);

      // Submit the question (Enter key)
      log.info(`  📤 Submitting question...`);
      await sendProgress?.("Submitting question...", 3, 5);
      await page.keyboard.press("Enter");

      // Small pause after submit
      await randomDelay(1000, 1500);

      // Wait for the response with streaming detection
      log.info(`  ⏳ Waiting for response (with streaming detection)...`);
      await sendProgress?.("Waiting for NotebookLM response (streaming detection active)...", 3, 5);

      // Fix 7: Periodic heartbeat during the up-to-120s response wait so the
      // session manager does not evict this session as idle while it is active.
      const heartbeat = setInterval(() => this.updateActivity(), 30000);
      let answer: string | null;
      try {
        answer = await waitForLatestAnswer(page, {
          question,
          timeoutMs: 120000, // 2 minutes
          pollIntervalMs: 1000,
          ignoreTexts: existingResponses,
          debug: false,
        });
      } finally {
        clearInterval(heartbeat);
      }

      if (!answer) {
        throw new Error("Timeout waiting for response from NotebookLM");
      }

      // Check for rate limit errors AFTER receiving answer
      log.info(`  🔍 Checking for rate limit errors...`);
      if (await this.detectRateLimitError()) {
        throw new RateLimitError(
          "NotebookLM rate limit reached (50 queries/day for free accounts)"
        );
      }

      // Update session stats
      this.messageCount++;
      this.updateActivity();

      log.success(
        `✅ [${this.sessionId}] Received answer (${answer.length} chars, ${this.messageCount} total messages)`
      );

      return answer;
    };

    try {
      return await askOnce();
    } catch (error: any) {
      const msg = String(error?.message || error);
      if (/has been closed|Target .* closed|Browser has been closed|Context .* closed/i.test(msg)) {
        log.warning(`  ♻️  Detected closed page/context. Recovering session and retrying ask...`);
        try {
          this.initialized = false;
          if (this.page) { try { await this.page.close(); } catch (_e) { /* best-effort close */ } }
          this.page = null;
          await this.init();
          return await askOnce();
        } catch (e2) {
          log.error(`❌ Recovery failed: ${e2}`);
          throw e2;
        }
      }
      log.error(`❌ [${this.sessionId}] Failed to ask question: ${msg}`);
      throw error;
    }
  }

  /**
   * Find the chat input element
   *
   * IMPORTANT: Matches Python implementation EXACTLY!
   * - Uses SPECIFIC selectors from Python
   * - Checks ONLY visibility (NOT disabled state!)
   *
   * Based on Python ask() method from browser_session.py:166-171
   */
  private async findChatInput(): Promise<string | null> {
    if (!this.page) {
      return null;
    }

    // Fix 5: Multi-locale selectors — German-only fallback replaced with
    // locale-agnostic alternatives so non-German browsers are also supported.
    const selectors = [
      "textarea.query-box-input",                 // PRIMARY (class-based, locale-neutral)
      'textarea[aria-label*="query"]',             // English partial match
      'textarea[aria-label*="question"]',          // English
      'textarea[aria-label*="Ask"]',               // English
      'textarea[aria-label="Feld für Anfragen"]',  // German
      'textarea[role="textbox"]',                  // Generic fallback
    ];

    for (const selector of selectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            // NO disabled check! Just like Python!
            log.success(`  ✅ Found chat input: ${selector}`);
            return selector;
          }
        }
      } catch {
        continue;
      }
    }

    log.error(`  ❌ Could not find visible chat input`);
    return null;
  }

  /**
   * Detect if a rate limit error occurred
   *
   * Searches the page for error messages indicating rate limit/quota exhaustion.
   * Free NotebookLM accounts have 50 queries/day limit.
   *
   * @returns true if rate limit error detected, false otherwise
   */
  private async detectRateLimitError(): Promise<boolean> {
    if (!this.page) {
      return false;
    }

    // Error message selectors (common patterns for error containers)
    const errorSelectors = [
      ".error-message",
      ".error-container",
      "[role='alert']",
      ".rate-limit-message",
      "[data-error]",
      ".notification-error",
      ".alert-error",
      ".toast-error",
    ];

    // Keywords that indicate rate limiting
    const keywords = [
      "rate limit",
      "limit exceeded",
      "quota exhausted",
      "daily limit",
      "limit reached",
      "too many requests",
      "ratenlimit",
      "quota",
      "query limit",
      "request limit",
    ];

    // Check error containers for rate limit messages
    for (const selector of errorSelectors) {
      try {
        const elements = await this.page.$$(selector);
        for (const el of elements) {
          try {
            const text = await el.innerText();
            const lower = text.toLowerCase();

            if (keywords.some((k) => lower.includes(k))) {
              log.error(`🚫 Rate limit detected: ${text.slice(0, 100)}`);
              return true;
            }
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }

    // Also check if chat input is disabled (sometimes NotebookLM disables input when rate limited)
    try {
      const inputSelector = "textarea.query-box-input";
      const input = await this.page.$(inputSelector);
      if (input) {
        const isDisabled = await input.evaluate((el: any) => {
          return el.disabled || el.hasAttribute("disabled");
        });

        if (isDisabled) {
          // Check if there's an error message near the input
          const parent = await input.evaluateHandle((el) => el.parentElement);
          const parentEl = parent.asElement();
          if (parentEl) {
            try {
              const parentText = await parentEl.innerText();
              const lower = parentText.toLowerCase();
              if (keywords.some((k) => lower.includes(k))) {
                log.error(`🚫 Rate limit detected: Chat input disabled with error message`);
                return true;
              }
            } catch {
              // Ignore
            }
          }
        }
      }
    } catch {
      // Ignore errors checking input state
    }

    return false;
  }

  /**
   * Reset the chat history (start a new conversation)
   */
  async reset(): Promise<void> {
    const resetOnce = async (): Promise<void> => {
      if (!this.initialized || !this.page || this.isPageClosedSafe()) {
        await this.init();
      }
      log.info(`🔄 [${this.sessionId}] Resetting chat history...`);
      // Reload the page to clear chat history
      await (this.page as Page).reload({ waitUntil: "domcontentloaded" });
      await randomDelay(2000, 3000);

      // Wait for interface to be ready again
      await this.waitForNotebookLMReady();

      // Reset message count
      this.messageCount = 0;
      this.updateActivity();

      log.success(`✅ [${this.sessionId}] Chat history reset`);
    };

    try {
      await resetOnce();
    } catch (error: any) {
      const msg = String(error?.message || error);
      if (/has been closed|Target .* closed|Browser has been closed|Context .* closed/i.test(msg)) {
        log.warning(`  ♻️  Detected closed page/context during reset. Recovering and retrying...`);
        this.initialized = false;
        if (this.page) { try { await this.page.close(); } catch (_e) { /* best-effort close */ } }
        this.page = null;
        await this.init();
        await resetOnce();
        return;
      }
      log.error(`❌ [${this.sessionId}] Failed to reset: ${msg}`);
      throw error;
    }
  }

  /**
   * Add a text source to the notebook via browser UI
   *
   * @param title - Title for the source
   * @param content - Text content to add
   * @param sendProgress - Optional progress callback
   * @returns true if source was added successfully
   */
  async addTextSourceViaUI(
    title: string,
    content: string,
    sendProgress?: ProgressCallback
  ): Promise<boolean> {
    if (!this.page || !this.initialized) {
      throw new Error("Session not initialized");
    }

    log.info(`📝 [${this.sessionId}] Adding text source via UI: "${title}"`);

    try {
      const page = this.page;
      await sendProgress?.("Opening source panel...", 1, 6);

      // Dismiss any overlay/modal that might block clicks (e.g., new notebook onboarding)
      const overlay = page.locator('.cdk-overlay-backdrop-showing');
      if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
        log.info("  🔄 Dismissing overlay modal...");
        await page.keyboard.press('Escape');
        await randomDelay(500, 800);
      }

      // Click on Sources tab first (iPad Mini viewport uses role="tab")
      const sourcesTab = page.locator('[role="tab"]:has-text("Sources")').first();
      if (await sourcesTab.isVisible({ timeout: 3000 })) {
        await sourcesTab.click();
        await randomDelay(500, 800);
      }

      // Click the "Add sources" button (found via debug: button:has-text("Add sources"))
      const addSourceSelectors = [
        'button:has-text("Add sources")',           // Primary - found via debug
        'button[aria-label*="Add source"]',
        'button[aria-label*="add source"]',
        '[data-tooltip*="Add source"]',
        'button.add-source-button',
      ];

      let addButtonClicked = false;
      for (const sel of addSourceSelectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            await btn.click();
            addButtonClicked = true;
            log.info(`  ✅ Clicked add source button: ${sel}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!addButtonClicked) {
        // Try keyboard shortcut or alternative approach
        log.warning("  ⚠️  Could not find add source button, trying alternative...");
        // Some UIs use a menu - try clicking on Sources header
        const sourcesHeader = page.locator('text="Sources"').first();
        if (await sourcesHeader.isVisible({ timeout: 2000 })) {
          await sourcesHeader.click();
          await randomDelay(500, 1000);
        }
      }

      await randomDelay(1000, 1500);
      await sendProgress?.("Selecting text source option...", 2, 5);

      // Select "Copied text" or "Paste text" option
      const textOptionSelectors = [
        'button:has-text("Copied text")',           // Primary option
        'button:has-text("Paste text")',            // Alternative
        '[role="menuitem"]:has-text("Copied text")',
        '[role="menuitem"]:has-text("Paste text")',
        'button:has-text("Text")',                  // Generic fallback
      ];

      let textOptionClicked = false;
      for (const sel of textOptionSelectors) {
        try {
          const opt = page.locator(sel).first();
          if (await opt.isVisible({ timeout: 2000 })) {
            await opt.click();
            textOptionClicked = true;
            log.info(`  ✅ Selected text source option: ${sel}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!textOptionClicked) {
        throw new Error("Could not find text source option in menu");
      }

      await randomDelay(1000, 1500);
      await sendProgress?.("Filling in source details...", 3, 5);

      // Fill in the title field
      const titleInputSelectors = [
        'input[placeholder*="title"]',
        'input[placeholder*="Title"]',
        'input[aria-label*="title"]',
        'input[aria-label*="Title"]',
        'input[placeholder*="name"]',
        // German
        'input[placeholder*="Titel"]',
        // Generic - first input in dialog
        '[role="dialog"] input:first-of-type',
      ];

      for (const sel of titleInputSelectors) {
        try {
          const input = page.locator(sel).first();
          if (await input.isVisible({ timeout: 2000 })) {
            await input.fill(title);
            log.info(`  ✅ Filled title: ${sel}`);
            break;
          }
        } catch {
          continue;
        }
      }

      // Fill in the content field (textarea)
      const contentSelectors = [
        'textarea[placeholder*="Paste"]',
        'textarea[placeholder*="paste"]',
        'textarea[placeholder*="content"]',
        'textarea[aria-label*="content"]',
        'textarea[aria-label*="text"]',
        // German
        'textarea[placeholder*="Einfügen"]',
        // Generic - textarea in dialog
        '[role="dialog"] textarea',
      ];

      for (const sel of contentSelectors) {
        try {
          const textarea = page.locator(sel).first();
          if (await textarea.isVisible({ timeout: 2000 })) {
            await textarea.fill(content);
            log.info(`  ✅ Filled content: ${sel}`);
            break;
          }
        } catch {
          continue;
        }
      }

      await randomDelay(500, 1000);
      await sendProgress?.("Submitting source...", 4, 5);

      // Click submit/insert button
      const submitSelectors = [
        'button:has-text("Insert")',
        'button:has-text("Add")',
        'button:has-text("Save")',
        'button:has-text("Submit")',
        // German
        'button:has-text("Einfügen")',
        'button:has-text("Hinzufügen")',
        // Generic primary button in dialog
        '[role="dialog"] button[type="submit"]',
        '[role="dialog"] button.primary',
      ];

      let submitted = false;
      for (const sel of submitSelectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            await btn.click();
            submitted = true;
            log.info(`  ✅ Clicked submit: ${sel}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!submitted) {
        throw new Error("Could not find submit button");
      }

      // Wait for source to be processed
      await randomDelay(2000, 3000);
      await sendProgress?.("Source added, waiting for processing...", 5, 5);

      this.updateActivity();
      log.success(`✅ [${this.sessionId}] Text source added via UI: "${title}"`);
      return true;

    } catch (error) {
      log.error(`❌ [${this.sessionId}] Failed to add text source via UI: ${error}`);
      throw error;
    }
  }

  /**
   * Add a file source to the notebook via browser UI
   *
   * @param filePath - Local file path to upload
   * @param sendProgress - Optional progress callback
   * @returns true if source was added successfully
   */
  async addFileSourceViaUI(
    filePath: string,
    sendProgress?: ProgressCallback
  ): Promise<boolean> {
    if (!this.page || !this.initialized) {
      throw new Error("Session not initialized");
    }

    log.info(`📁 [${this.sessionId}] Adding file source via UI: "${filePath}"`);

    try {
      const page = this.page;
      await sendProgress?.("Opening source panel...", 1, 6);

      // Dismiss any overlay/modal that might block clicks (e.g., new notebook onboarding)
      const overlay = page.locator('.cdk-overlay-backdrop-showing');
      if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
        log.info("  🔄 Dismissing overlay modal...");
        await page.keyboard.press('Escape');
        await randomDelay(500, 800);
      }

      // Click on Sources tab first (iPad Mini viewport uses role="tab")
      const sourcesTab = page.locator('[role="tab"]:has-text("Sources")').first();
      if (await sourcesTab.isVisible({ timeout: 3000 })) {
        await sourcesTab.click();
        await randomDelay(500, 800);
      }

      // Click add source button
      const addBtn = page.locator('button:has-text("Add sources"), button[aria-label*="Add source"]').first();
      await addBtn.click({ timeout: 5000 });
      await randomDelay(1000, 1500);

      await sendProgress?.("Selecting file upload option...", 2, 6);

      // Select file upload option
      const fileOptionSelectors = [
        'button:has-text("Upload")',
        'button:has-text("File")',
        '[role="menuitem"]:has-text("Upload")',
        '[role="menuitem"]:has-text("File")',
      ];

      let selected = false;
      for (const sel of fileOptionSelectors) {
        try {
          const opt = page.locator(sel).first();
          if (await opt.isVisible({ timeout: 2000 })) {
            await opt.click();
            log.info(`  ✅ Selected file option: ${sel}`);
            selected = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!selected) {
        throw new Error("Could not find file upload option");
      }

      await randomDelay(1500, 2000);
      await sendProgress?.("Selecting file...", 3, 4);

      // Look for the file input or a button that triggers file chooser
      // NotebookLM may show a drag-drop area with a "browse" link or hidden file input
      const fileInputSelectors = [
        'input[type="file"]',
        '.cdk-overlay-pane input[type="file"]',
        '[role="dialog"] input[type="file"]',
      ];

      let fileInput = null;
      for (const sel of fileInputSelectors) {
        try {
          const input = page.locator(sel).first();
          // File inputs are often hidden, so just check if it exists
          if (await input.count() > 0) {
            fileInput = input;
            log.info(`  ✅ Found file input: ${sel}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (fileInput) {
        // Direct file input - use setInputFiles
        await fileInput.setInputFiles(filePath);
        log.info(`  ✅ File set via input: ${filePath}`);
      } else {
        // Try clicking a browse/choose button with file chooser
        const browseSelectors = [
          'button:has-text("browse")',
          'button:has-text("Browse")',
          'button:has-text("Choose")',
          'a:has-text("browse")',
          '.cdk-overlay-pane button',
        ];

        let clicked = false;
        for (const sel of browseSelectors) {
          try {
            const [fileChooser] = await Promise.all([
              page.waitForEvent('filechooser', { timeout: 5000 }),
              page.locator(sel).first().click({ timeout: 2000 })
            ]);
            await fileChooser.setFiles(filePath);
            log.info(`  ✅ File selected via chooser: ${filePath}`);
            clicked = true;
            break;
          } catch {
            continue;
          }
        }

        if (!clicked) {
          throw new Error("Could not find file input or browse button");
        }
      }

      await sendProgress?.("Processing upload...", 4, 4);
      await randomDelay(3000, 5000); // File upload takes time

      this.updateActivity();
      log.success(`✅ [${this.sessionId}] File source added via UI: "${filePath}"`);
      return true;

    } catch (error) {
      log.error(`❌ [${this.sessionId}] Failed to add file source via UI: ${error}`);
      throw error;
    }
  }

  /**
   * Add a URL source to the notebook via browser UI
   *
   * @param url - URL to add as source
   * @param sendProgress - Optional progress callback
   * @returns true if source was added successfully
   */
  async addURLSourceViaUI(
    url: string,
    sendProgress?: ProgressCallback
  ): Promise<boolean> {
    if (!this.page || !this.initialized) {
      throw new Error("Session not initialized");
    }

    log.info(`🔗 [${this.sessionId}] Adding URL source via UI: "${url}"`);

    try {
      const page = this.page;
      await sendProgress?.("Opening source panel...", 1, 5);

      // Dismiss any overlay/modal that might block clicks (e.g., new notebook onboarding)
      const overlay = page.locator('.cdk-overlay-backdrop-showing');
      if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
        log.info("  🔄 Dismissing overlay modal...");
        await page.keyboard.press('Escape');
        await randomDelay(500, 800);
      }

      // Click on Sources tab first (iPad Mini viewport uses role="tab")
      const sourcesTab = page.locator('[role="tab"]:has-text("Sources")').first();
      if (await sourcesTab.isVisible({ timeout: 3000 })) {
        await sourcesTab.click();
        await randomDelay(500, 800);
      }

      // Click add source button
      const addBtn = page.locator('button:has-text("Add sources"), button[aria-label*="Add source"]').first();
      await addBtn.click({ timeout: 5000 });
      await randomDelay(1000, 1500);

      await sendProgress?.("Selecting website option...", 2, 5);

      // Select website/URL option
      const urlOptionSelectors = [
        'button:has-text("Websites")',
        'button:has-text("Website")',
        '[role="menuitem"]:has-text("Websites")',
        '[role="menuitem"]:has-text("Website")',
      ];

      for (const sel of urlOptionSelectors) {
        try {
          const opt = page.locator(sel).first();
          if (await opt.isVisible({ timeout: 2000 })) {
            await opt.click();
            log.info(`  ✅ Selected URL option: ${sel}`);
            break;
          }
        } catch {
          continue;
        }
      }

      await randomDelay(1500, 2000);
      await sendProgress?.("Entering URL...", 3, 4);

      // Fill URL textarea - NotebookLM uses textarea with "Paste any links" placeholder
      const urlTextareaSelectors = [
        'textarea[placeholder*="Paste any links"]',
        'textarea[placeholder*="Paste"]',
        '.cdk-overlay-pane textarea',
        '[role="dialog"] textarea',
      ];

      let filled = false;
      for (const sel of urlTextareaSelectors) {
        try {
          const textarea = page.locator(sel).first();
          if (await textarea.isVisible({ timeout: 1500 })) {
            await textarea.fill(url);
            log.info(`  ✅ Filled URL: ${sel}`);
            filled = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!filled) {
        throw new Error("Could not find URL textarea");
      }

      await randomDelay(500, 1000);
      await sendProgress?.("Submitting...", 4, 4);

      // Submit - look in dialog context
      const submitSelectors = [
        '.cdk-overlay-pane button:has-text("Insert")',
        '[role="dialog"] button:has-text("Insert")',
        'button:has-text("Insert")',
      ];

      for (const sel of submitSelectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 1500 })) {
            await btn.click();
            log.info(`  ✅ Clicked submit: ${sel}`);
            break;
          }
        } catch {
          continue;
        }
      }

      // Wait for dialog to close
      await page.waitForSelector('textarea[placeholder*="Paste any links"]', {
        state: 'hidden',
        timeout: 30000
      }).catch(() => {});

      await randomDelay(2000, 3000);

      // Verify source was added by checking source count
      const sourceCount = await page.locator('.source-item, [data-source-id], mat-list-item').count();
      const sourceAdded = sourceCount > 0;

      this.updateActivity();

      if (sourceAdded) {
        log.success(`✅ [${this.sessionId}] URL source added via UI: "${url}" (${sourceCount} sources)`);
        return true;
      } else {
        log.warning(`⚠️ [${this.sessionId}] Source may not have been added: "${url}"`);
        return true; // Still return true as click succeeded, source might be processing
      }

    } catch (error) {
      log.error(`❌ [${this.sessionId}] Failed to add URL source via UI: ${error}`);
      throw error;
    }
  }

  /**
   * Add a YouTube source to the notebook via browser UI
   *
   * @param youtubeUrl - YouTube video URL
   * @param sendProgress - Optional progress callback
   * @returns true if source was added successfully
   */
  async addYouTubeSourceViaUI(
    youtubeUrl: string,
    sendProgress?: ProgressCallback
  ): Promise<boolean> {
    if (!this.page || !this.initialized) {
      throw new Error("Session not initialized");
    }

    log.info(`🎥 [${this.sessionId}] Adding YouTube source via UI: "${youtubeUrl}"`);

    try {
      const page = this.page;
      await sendProgress?.("Opening source panel...", 1, 6);

      // Dismiss any overlay/modal that might block clicks (e.g., new notebook onboarding)
      const overlay = page.locator('.cdk-overlay-backdrop-showing');
      if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
        log.info("  🔄 Dismissing overlay modal...");
        await page.keyboard.press('Escape');
        await randomDelay(500, 800);
      }

      // Click on Sources tab first (iPad Mini viewport uses role="tab")
      const sourcesTab = page.locator('[role="tab"]:has-text("Sources")').first();
      if (await sourcesTab.isVisible({ timeout: 3000 })) {
        await sourcesTab.click();
        await randomDelay(500, 800);
      }

      // Click add source button
      const addBtn = page.locator('button:has-text("Add sources"), button[aria-label*="Add source"]').first();
      await addBtn.click({ timeout: 5000 });
      await randomDelay(1000, 1500);

      await sendProgress?.("Selecting Website/YouTube option...", 2, 6);

      // Select Website option - opens "Website and YouTube URLs" dialog
      const urlOptionSelectors = [
        'button:has-text("Website")',
        '[role="menuitem"]:has-text("Website")',
        'button:has-text("Link")',
        'button:has-text("URL")',
        'button:has-text("YouTube")',
        '[role="menuitem"]:has-text("YouTube")',
      ];

      let selected = false;
      for (const sel of urlOptionSelectors) {
        try {
          const opt = page.locator(sel).first();
          if (await opt.isVisible({ timeout: 2000 })) {
            await opt.click();
            log.info(`  ✅ Selected URL option: ${sel}`);
            selected = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!selected) {
        throw new Error("Could not find Website/YouTube source option");
      }

      await randomDelay(2000, 2500); // Wait for dialog to fully render
      await sendProgress?.("Entering YouTube URL...", 3, 4);

      // Fill URL textarea - NotebookLM uses textarea with "Paste any links" placeholder
      const urlTextareaSelectors = [
        'textarea[placeholder*="Paste any links"]',
        'textarea[placeholder*="Paste"]',
        'textarea[placeholder*="paste"]',
        'textarea[placeholder*="link"]',
        'textarea[placeholder*="URL"]',
        '.cdk-overlay-pane textarea',
        '[role="dialog"] textarea',
      ];

      let filled = false;
      for (const sel of urlTextareaSelectors) {
        try {
          const textarea = page.locator(sel).first();
          if (await textarea.isVisible({ timeout: 1500 })) {
            await textarea.fill(youtubeUrl);
            log.info(`  ✅ Filled YouTube URL: ${sel}`);
            filled = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!filled) {
        throw new Error("Could not find URL textarea");
      }

      await randomDelay(500, 1000);
      await sendProgress?.("Submitting...", 4, 4);

      // Submit - look in dialog context first
      const submitSelectors = [
        '.cdk-overlay-pane button:has-text("Insert")',
        '.cdk-overlay-pane button:has-text("Add")',
        '[role="dialog"] button:has-text("Insert")',
        '[role="dialog"] button:has-text("Add")',
        'button:has-text("Insert")',
        'button:has-text("Add")',
        'button[type="submit"]',
      ];

      let submitted = false;
      for (const sel of submitSelectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 1500 })) {
            await btn.click();
            log.info(`  ✅ Clicked submit: ${sel}`);
            submitted = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!submitted) {
        log.warning('  ⚠️  Submit button not found, dialog may have auto-submitted');
      }

      await randomDelay(3000, 4000); // YouTube processing takes longer

      this.updateActivity();
      log.success(`✅ [${this.sessionId}] YouTube source added via UI: "${youtubeUrl}"`);
      return true;

    } catch (error) {
      log.error(`❌ [${this.sessionId}] Failed to add YouTube source via UI: ${error}`);
      throw error;
    }
  }

  /**
   * Search the web for new sources and add them to the notebook
   *
   * @param query - Search query
   * @param sendProgress - Optional progress callback
   * @returns true if search was submitted successfully
   */
  async searchWebForSourcesViaUI(
    query: string,
    sendProgress?: ProgressCallback
  ): Promise<boolean> {
    if (!this.page || !this.initialized) {
      throw new Error("Session not initialized");
    }

    log.info(`🔍 [${this.sessionId}] Searching web for sources: "${query}"`);

    try {
      const page = this.page;
      await sendProgress?.("Opening search panel...", 1, 3);

      // Find the search input in the sources panel
      const searchInputSelectors = [
        'input[placeholder*="Search the web"]',
        'input[placeholder*="Search"]',
        'input[aria-label*="Search"]',
        '.sources-panel input[type="text"]',
      ];

      let searchInput = null;
      for (const sel of searchInputSelectors) {
        try {
          const input = page.locator(sel).first();
          if (await input.isVisible({ timeout: 2000 })) {
            searchInput = input;
            log.info(`  ✅ Found search input: ${sel}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!searchInput) {
        throw new Error("Could not find web search input");
      }

      await sendProgress?.("Entering search query...", 2, 3);

      // Fill the search query
      await searchInput.fill(query);
      await randomDelay(500, 1000);

      await sendProgress?.("Submitting search...", 3, 3);

      // Click the submit button (arrow icon)
      const submitSelectors = [
        'button[aria-label*="Search"]',
        'button[aria-label*="Submit"]',
        'button:has(mat-icon:has-text("arrow_forward"))',
        'button:has(span:has-text("arrow_forward"))',
        '.sources-panel button[type="submit"]',
      ];

      let submitted = false;
      for (const sel of submitSelectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 1500 })) {
            await btn.click();
            log.info(`  ✅ Clicked search submit: ${sel}`);
            submitted = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!submitted) {
        // Try pressing Enter as fallback
        await searchInput.press('Enter');
        log.info(`  ✅ Pressed Enter to submit search`);
      }

      await randomDelay(3000, 5000); // Wait for search results

      this.updateActivity();
      log.success(`✅ [${this.sessionId}] Web search submitted: "${query}"`);
      return true;

    } catch (error) {
      log.error(`❌ [${this.sessionId}] Failed to search web for sources: ${error}`);
      throw error;
    }
  }

  /**
   * List sources in the notebook via browser UI
   *
   * @returns Array of source objects with title and id
   */
  async listSourcesViaUI(): Promise<Array<{ title: string; id?: string }>> {
    if (!this.page || !this.initialized) {
      throw new Error("Session not initialized");
    }

    log.info(`📚 [${this.sessionId}] Listing sources via UI...`);

    try {
      const page = this.page;

      // Click on Sources tab first (iPad Mini viewport uses role="tab")
      const sourcesTab = page.locator('[role="tab"]:has-text("Sources")').first();
      if (await sourcesTab.isVisible({ timeout: 5000 })) {
        await sourcesTab.click();
        await randomDelay(1000, 1500);
      }

      // Use JS evaluation to get source titles (most reliable method)
      // Sources have button.source-stretched-button with aria-label containing the title
      const sourceData = await page.evaluate(`
        Array.from(document.querySelectorAll('button[aria-label]'))
          .filter(b => b.classList.contains('source-stretched-button'))
          .map(b => ({
            title: b.getAttribute('aria-label') || '',
            id: b.closest('[draggable]')?.querySelector('[id*="source"]')?.id || undefined
          }))
          .filter(s => s.title.length > 0)
      `) as Array<{ title: string; id?: string }>;

      log.success(`✅ [${this.sessionId}] Found ${sourceData.length} sources via UI`);
      this.updateActivity();
      return sourceData;

    } catch (error) {
      log.error(`❌ [${this.sessionId}] Failed to list sources via UI: ${error}`);
      return [];
    }
  }

  /**
   * Close the session
   */
  async close(): Promise<void> {
    if (this.isClosing) return;
    this.isClosing = true;
    log.info(`🛑 Closing session ${this.sessionId}...`);

    if (this.page) {
      try {
        await this.page.close();
        this.page = null;
        log.success(`  ✅ Page closed`);
      } catch (error) {
        log.warning(`  ⚠️  Error closing page: ${error}`);
      }
    }

    this.initialized = false;
    log.success(`✅ Session ${this.sessionId} closed`);
  }

  /**
   * Check if session is closed or closing
   */
  isClosed(): boolean {
    return this.isClosing || !this.initialized;
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    this.lastActivity = Date.now();
  }

  /**
   * Check if session has expired (inactive for too long)
   */
  isExpired(timeoutSeconds: number): boolean {
    const inactiveSeconds = (Date.now() - this.lastActivity) / 1000;
    return inactiveSeconds > timeoutSeconds;
  }

  /**
   * Get session information
   */
  getInfo(): SessionInfo {
    const now = Date.now();
    return {
      id: this.sessionId,
      created_at: this.createdAt,
      last_activity: this.lastActivity,
      age_seconds: (now - this.createdAt) / 1000,
      inactive_seconds: (now - this.lastActivity) / 1000,
      message_count: this.messageCount,
      notebook_url: this.notebookUrl,
    };
  }

  /**
   * Get the underlying page (for advanced operations)
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Check if session is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.page !== null;
  }
}
