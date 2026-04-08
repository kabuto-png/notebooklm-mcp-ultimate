/**
 * Notebook CRUD Operations for NotebookLM
 *
 * Browser-only implementations for creating, renaming, and deleting notebooks.
 * No API client - all operations via Playwright browser automation.
 */

import { chromium } from 'patchright';
import { AuthManager } from '../auth/auth-manager.js';
import { log } from '../utils/logger.js';
import { randomDelay } from '../utils/stealth-utils.js';
import * as fs from 'fs';
import * as path from 'path';

/** Validates notebook ID format (basic non-empty check) */
function validateNotebookId(notebookId: string): string | null {
    if (!notebookId || typeof notebookId !== 'string' || !notebookId.trim()) {
        return 'Notebook ID is required';
    }
    return null; // Valid
}

/**
 * Result of a notebook CRUD operation
 */
export interface NotebookCRUDResult {
    success: boolean;
    notebookId?: string;
    title?: string;
    error?: string;
    url?: string;
}

/**
 * Create a new notebook in NotebookLM via browser
 *
 * @param title - Optional title for the notebook (defaults to "Untitled notebook")
 * @returns Result with notebook ID and URL
 */
export async function createNotebook(
    title?: string
): Promise<NotebookCRUDResult> {
    const authManager = new AuthManager();
    const statePath = await authManager.getValidStatePath();

    if (!statePath) {
        return {
            success: false,
            error: 'Not authenticated. Please run setup_auth first.',
        };
    }

    let context: import('patchright').BrowserContext | null = null;
    try {
        log.info(`Creating notebook via browser${title ? `: ${title}` : ''}...`);

        const { CONFIG } = await import('../config.js');
        // Use launchPersistentContext like session manager (preserves Google auth)
        context = await chromium.launchPersistentContext(CONFIG.chromeProfileDir, {
            headless: true,
            viewport: CONFIG.viewport,
            args: [
                `--window-size=${CONFIG.viewport.width},${CONFIG.viewport.height}`,
                "--disable-blink-features=AutomationControlled",
            ],
        });
        const page = await context.newPage();

        // Navigate to NotebookLM home
        log.info('  🌐 Navigating to NotebookLM home...');
        await page.goto('https://notebooklm.google.com/', { waitUntil: 'load', timeout: 30000 });
        const currentUrl = page.url();
        log.info(`  📍 Current URL: ${currentUrl}`);

        // Check if redirected to login
        if (currentUrl.includes('accounts.google.com')) {
            log.error('  ❌ Redirected to Google login - auth not working');
            return { success: false, error: 'Not authenticated. Browser redirected to Google login.' };
        }

        await randomDelay(3000, 4000); // Wait for Angular to render

        // Wait for the create button to appear (most reliable selector)
        const createBtn = page.locator('[aria-label="Create new notebook"]').first();
        try {
            log.info('  🔍 Looking for Create button...');
            await createBtn.waitFor({ state: 'visible', timeout: 10000 });
            await createBtn.click();
            log.info('  ✅ Clicked: [aria-label="Create new notebook"]');
        } catch {
            // Fallback selectors
            log.warning('  ⚠️ Primary selector failed, trying fallbacks...');
            const fallbacks = ['button:has-text("Create new")', '[aria-label*="Create new"]'];
            let clicked = false;
            for (const sel of fallbacks) {
                try {
                    const btn = page.locator(sel).first();
                    if (await btn.isVisible({ timeout: 3000 })) {
                        await btn.click();
                        clicked = true;
                        log.info(`  ✅ Clicked: ${sel}`);
                        break;
                    }
                } catch { continue; }
            }
            if (!clicked) {
                // Log URL for debugging
                const url = page.url();
                log.error(`  ❌ Could not find Create button. URL: ${url}`);
                return { success: false, error: `Could not find Create notebook button. Current URL: ${url}` };
            }
        }

        // Wait for new notebook to load (URL changes to /notebook/{id})
        await page.waitForURL(/\/notebook\/[a-f0-9-]+/, { timeout: 15000 });
        await randomDelay(1000, 2000);

        // Extract notebook ID from URL
        const url = page.url();
        const match = url.match(/\/notebook\/([a-f0-9-]+)/);
        if (!match) {
            return { success: false, error: 'Could not extract notebook ID from URL' };
        }

        const notebookId = match[1];

        // If title provided, rename the notebook
        if (title) {
            // Click on the title to edit it
            const titleSelectors = [
                '[contenteditable="true"]',
                '.notebook-title',
                'h1[contenteditable]',
                'input[aria-label*="title"]',
            ];

            for (const sel of titleSelectors) {
                try {
                    const titleEl = page.locator(sel).first();
                    if (await titleEl.isVisible({ timeout: 2000 })) {
                        await titleEl.click();
                        await randomDelay(300, 500);
                        // Select all and type new title
                        await page.keyboard.press('Control+a');
                        await page.keyboard.type(title, { delay: 50 });
                        await page.keyboard.press('Enter');
                        await randomDelay(500, 1000);
                        log.info(`  ✅ Renamed to: ${title}`);
                        break;
                    }
                } catch {
                    continue;
                }
            }
        }

        log.success(`Notebook created: ${notebookId}`);

        return {
            success: true,
            notebookId,
            title: title || 'Untitled notebook',
            url,
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to create notebook: ${error}`,
        };
    } finally {
        if (context) {
            await context.close();
        }
    }
}

/**
 * Rename a notebook in NotebookLM via browser
 *
 * @param notebookId - The notebook ID to rename
 * @param newTitle - The new title for the notebook
 * @returns Result indicating success or failure
 */
export async function renameNotebook(
    notebookId: string,
    newTitle: string
): Promise<NotebookCRUDResult> {
    const idError = validateNotebookId(notebookId);
    if (idError) {
        return { success: false, error: idError, notebookId };
    }

    if (!newTitle || typeof newTitle !== 'string' || !newTitle.trim()) {
        return { success: false, error: 'New title is required and must be non-empty', notebookId };
    }

    const authManager = new AuthManager();
    const statePath = await authManager.getValidStatePath();

    if (!statePath) {
        return {
            success: false,
            error: 'Not authenticated. Please run setup_auth first.',
            notebookId,
        };
    }

    let context: import('patchright').BrowserContext | null = null;
    try {
        log.info(`Renaming notebook ${notebookId} to "${newTitle}" via browser...`);

        const { CONFIG } = await import('../config.js');
        context = await chromium.launchPersistentContext(CONFIG.chromeProfileDir, {
            headless: true,
            viewport: CONFIG.viewport,
            args: [
                `--window-size=${CONFIG.viewport.width},${CONFIG.viewport.height}`,
                "--disable-blink-features=AutomationControlled",
            ],
        });
        const page = await context.newPage();

        // Navigate to notebook
        const notebookUrl = `https://notebooklm.google.com/notebook/${notebookId}`;
        await page.goto(notebookUrl, { waitUntil: 'load', timeout: 30000 });
        await randomDelay(2000, 3000);

        // Find the notebook title input field
        // NotebookLM's title input has NO type attribute (just <input> without type="text")
        // The search input has type="text" and placeholder="Search"
        let renamed = false;

        try {
            // Primary selector: input without type attribute (excludes search which has type="text")
            const titleInput = page.locator('input:not([type])').first();
            if (await titleInput.isVisible({ timeout: 3000 })) {
                const value = await titleInput.inputValue().catch(() => '');
                log.info(`Found title input with value: "${value.substring(0, 50)}"`);

                await titleInput.click();
                await randomDelay(200, 400);
                await titleInput.fill('');
                await randomDelay(100, 200);
                await titleInput.fill(newTitle);
                await randomDelay(200, 400);
                await page.keyboard.press('Tab'); // Blur to save
                await randomDelay(500, 1000);
                renamed = true;
            }
        } catch {
            // Primary approach failed
        }

        // Fallback: use Settings menu to rename
        if (!renamed) {
            try {
                const settingsBtn = page.locator('button[aria-label="Settings"]').first();
                if (await settingsBtn.isVisible({ timeout: 2000 })) {
                    await settingsBtn.click();
                    await randomDelay(500, 800);

                    // Look for rename option in the menu
                    const renameBtn = page.locator('button:has-text("Rename"), [role="menuitem"]:has-text("Rename")').first();
                    if (await renameBtn.isVisible({ timeout: 2000 })) {
                        await renameBtn.click();
                        await randomDelay(300, 500);

                        // Type new name in dialog input
                        const dialogInput = page.locator('input[type="text"]').first();
                        await dialogInput.fill(newTitle);
                        await randomDelay(200, 400);

                        // Confirm
                        const confirmBtn = page.locator('button:has-text("Save"), button:has-text("OK"), button:has-text("Done")').first();
                        await confirmBtn.click();
                        await randomDelay(500, 1000);
                        renamed = true;
                    }
                }
            } catch {
                // Settings menu approach failed
            }
        }

        if (!renamed) {
            return { success: false, error: 'Could not find title element to rename', notebookId };
        }

        log.success(`Notebook renamed to: ${newTitle}`);

        return {
            success: true,
            notebookId,
            title: newTitle,
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to rename notebook: ${error}`,
            notebookId,
        };
    } finally {
        if (context) {
            await context.close();
        }
    }
}

/**
 * Delete a notebook in NotebookLM via browser
 *
 * @param notebookId - The notebook ID to delete
 * @returns Result indicating success or failure
 */
export async function deleteNotebookRemote(
    notebookId: string
): Promise<NotebookCRUDResult> {
    const idError = validateNotebookId(notebookId);
    if (idError) {
        return { success: false, error: idError, notebookId };
    }

    const authManager = new AuthManager();
    const statePath = await authManager.getValidStatePath();

    if (!statePath) {
        return {
            success: false,
            error: 'Not authenticated. Please run setup_auth first.',
            notebookId,
        };
    }

    let context: import('patchright').BrowserContext | null = null;
    try {
        log.info(`Deleting notebook ${notebookId} via browser...`);

        const { CONFIG } = await import('../config.js');
        context = await chromium.launchPersistentContext(CONFIG.chromeProfileDir, {
            headless: true,
            viewport: CONFIG.viewport,
            args: [
                `--window-size=${CONFIG.viewport.width},${CONFIG.viewport.height}`,
                "--disable-blink-features=AutomationControlled",
            ],
        });
        const page = await context.newPage();

        // Navigate to home page (notebook list) - delete is available from card menu, not inside notebook
        await page.goto('https://notebooklm.google.com/', { waitUntil: 'load', timeout: 30000 });
        await randomDelay(2000, 3000);

        // Click "My notebooks" tab to ensure we're viewing our notebooks
        try {
            const myNotebooksTab = page.locator('button:has-text("My notebooks")').first();
            if (await myNotebooksTab.isVisible({ timeout: 2000 })) {
                await myNotebooksTab.click();
                await randomDelay(1000, 2000);
            }
        } catch {
            // Tab might not be visible, continue anyway
        }

        // Find the notebook card by looking for elements that reference the notebook ID
        // NotebookLM uses aria-labelledby="project-{notebookId}-title" on the card's button
        const cardButton = page.locator(`button[aria-labelledby*="${notebookId}"], [id*="${notebookId}"]`).first();
        if (!await cardButton.isVisible({ timeout: 5000 })) {
            return { success: false, error: 'Notebook not found on home page', notebookId };
        }

        // Find the parent mat-card container and then the menu button within it
        const card = cardButton.locator('xpath=ancestor::mat-card').first();
        const menuBtn = card.locator('button[aria-label="Project Actions Menu"], button:has-text("more_vert")').first();

        if (!await menuBtn.isVisible({ timeout: 3000 })) {
            return { success: false, error: 'Could not find menu button on notebook card', notebookId };
        }

        await menuBtn.click();
        await randomDelay(500, 800);

        // Click delete option from the dropdown menu
        const deleteBtn = page.locator('button:has-text("Delete"), [role="menuitem"]:has-text("Delete")').first();
        if (!await deleteBtn.isVisible({ timeout: 2000 })) {
            return { success: false, error: 'Could not find delete option in menu', notebookId };
        }

        await deleteBtn.click();
        await randomDelay(500, 800);

        // Confirm deletion in dialog (if there is one)
        try {
            const confirmBtn = page.locator('button:has-text("Delete"):visible, button:has-text("Confirm"):visible').first();
            if (await confirmBtn.isVisible({ timeout: 2000 })) {
                await confirmBtn.click();
                await randomDelay(1000, 2000);
            }
        } catch {
            // No confirmation dialog, deletion was immediate
        }

        log.success(`Notebook deleted: ${notebookId}`);

        return {
            success: true,
            notebookId,
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to delete notebook: ${error}`,
            notebookId,
        };
    } finally {
        if (context) {
            await context.close();
        }
    }
}

/**
 * Upload a file source to a notebook via browser automation
 * Supports PDF, docs, images, audio files
 *
 * @param notebookId - The notebook ID to add source to
 * @param filePath - Absolute path to the file to upload
 * @returns Result with upload status
 */
export async function addFileSource(
    notebookId: string,
    filePath: string
): Promise<NotebookCRUDResult> {
    const idError = validateNotebookId(notebookId);
    if (idError) {
        return { success: false, error: idError, notebookId };
    }

    // Validate path is absolute and not traversing
    if (!path.isAbsolute(filePath)) {
        return { success: false, error: 'File path must be absolute', notebookId };
    }
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath !== filePath || filePath.includes('..')) {
        return { success: false, error: 'Invalid file path (path traversal not allowed)', notebookId };
    }

    // Validate file exists
    if (!fs.existsSync(filePath)) {
        return {
            success: false,
            error: `File not found: ${filePath}`,
            notebookId,
        };
    }

    const authManager = new AuthManager();
    const statePath = await authManager.getValidStatePath();

    if (!statePath) {
        return {
            success: false,
            error: 'Not authenticated. Please run setup_auth first.',
            notebookId,
        };
    }

    let context: import('patchright').BrowserContext | null = null;
    try {
        log.info(`Uploading file to notebook ${notebookId}: ${path.basename(filePath)}`);

        const { CONFIG } = await import('../config.js');
        context = await chromium.launchPersistentContext(CONFIG.chromeProfileDir, {
            headless: true,
            viewport: CONFIG.viewport,
            args: [
                `--window-size=${CONFIG.viewport.width},${CONFIG.viewport.height}`,
                "--disable-blink-features=AutomationControlled",
            ],
        });
        const page = await context.newPage();

        // Navigate to notebook
        const notebookUrl = `https://notebooklm.google.com/notebook/${notebookId}`;
        await page.goto(notebookUrl, { waitUntil: 'load', timeout: 30000 });

        // Click "Add sources" button
        await page.click('button:has-text("Add sources")', { timeout: 10000 });
        await page.waitForTimeout(1000);

        // Click "Upload files" button in dialog
        await page.click('button:has-text("Upload files")', { timeout: 10000 });

        // Wait for file input and set file
        const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 10000 });
        await fileInput.setInputFiles(filePath);

        // Wait for upload to complete (source appears in list)
        await page.waitForSelector('.source-item, [class*="source"]', { timeout: 60000 });

        log.success(`File uploaded: ${path.basename(filePath)}`);

        return {
            success: true,
            notebookId,
            title: path.basename(filePath),
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to upload file: ${error}`,
            notebookId,
        };
    } finally {
        if (context) {
            await context.close();
        }
    }
}
