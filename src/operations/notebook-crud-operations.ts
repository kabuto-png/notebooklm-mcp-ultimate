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

    let browser;
    try {
        log.info(`Creating notebook via browser${title ? `: ${title}` : ''}...`);

        const { CONFIG } = await import('../config.js');
        browser = await chromium.launch({
            headless: true,
            args: [`--window-size=${CONFIG.viewport.width},${CONFIG.viewport.height}`],
        });
        const context = await browser.newContext({
            storageState: statePath,
            viewport: CONFIG.viewport,
        });
        const page = await context.newPage();

        // Navigate to NotebookLM home
        await page.goto('https://notebooklm.google.com/', { waitUntil: 'networkidle', timeout: 30000 });
        await randomDelay(1000, 2000);

        // Click "Create notebook" button (try multiple selectors)
        // From screenshot: "+ Create new" button in header, or "Create new notebook" card
        const createSelectors = [
            'button:has-text("Create new")',           // Header button
            '[aria-label*="Create new"]',              // Aria label match
            ':has-text("Create new notebook")',        // Card in Recent section
            'button:has-text("Create")',               // Fallback
            '[aria-label*="Create"]',                  // Generic aria
        ];

        let clicked = false;
        for (const sel of createSelectors) {
            try {
                const btn = page.locator(sel).first();
                if (await btn.isVisible({ timeout: 2000 })) {
                    await btn.click();
                    clicked = true;
                    log.info(`  ✅ Clicked: ${sel}`);
                    break;
                }
            } catch {
                continue;
            }
        }

        if (!clicked) {
            return { success: false, error: 'Could not find Create notebook button' };
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
        if (browser) {
            await browser.close();
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

    let browser;
    try {
        log.info(`Renaming notebook ${notebookId} to "${newTitle}" via browser...`);

        const { CONFIG } = await import('../config.js');
        browser = await chromium.launch({
            headless: true,
            args: [`--window-size=${CONFIG.viewport.width},${CONFIG.viewport.height}`],
        });
        const context = await browser.newContext({
            storageState: statePath,
            viewport: CONFIG.viewport,
        });
        const page = await context.newPage();

        // Navigate to notebook
        const notebookUrl = `https://notebooklm.google.com/notebook/${notebookId}`;
        await page.goto(notebookUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await randomDelay(1000, 2000);

        // Click on the title to edit it (try multiple approaches)
        const titleSelectors = [
            'h1:has-text("Untitled")',
            '.notebook-title',
            '[contenteditable="true"]:near(header)',
            'header [contenteditable]',
        ];

        let renamed = false;

        // First try: click title directly
        for (const sel of titleSelectors) {
            try {
                const titleEl = page.locator(sel).first();
                if (await titleEl.isVisible({ timeout: 2000 })) {
                    await titleEl.click();
                    await randomDelay(300, 500);
                    await page.keyboard.press('Control+a');
                    await page.keyboard.type(newTitle, { delay: 30 });
                    await page.keyboard.press('Enter');
                    await randomDelay(500, 1000);
                    renamed = true;
                    break;
                }
            } catch {
                continue;
            }
        }

        // Second try: use settings/menu if direct edit not available
        if (!renamed) {
            // Click settings or more menu
            const menuSelectors = [
                'button[aria-label*="Settings"]',
                'button[aria-label*="More"]',
                'button:has-text("⋮")',
                '[aria-label*="menu"]',
            ];

            for (const sel of menuSelectors) {
                try {
                    const menuBtn = page.locator(sel).first();
                    if (await menuBtn.isVisible({ timeout: 2000 })) {
                        await menuBtn.click();
                        await randomDelay(500, 800);

                        // Click rename option
                        const renameBtn = page.locator('button:has-text("Rename"), [role="menuitem"]:has-text("Rename")').first();
                        if (await renameBtn.isVisible({ timeout: 2000 })) {
                            await renameBtn.click();
                            await randomDelay(300, 500);

                            // Type new name in dialog
                            const input = page.locator('input[type="text"], input[aria-label*="name"]').first();
                            await input.fill(newTitle);
                            await randomDelay(200, 400);

                            // Confirm
                            const confirmBtn = page.locator('button:has-text("Save"), button:has-text("OK"), button:has-text("Rename")').first();
                            await confirmBtn.click();
                            await randomDelay(500, 1000);
                            renamed = true;
                            break;
                        }
                    }
                } catch {
                    continue;
                }
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
        if (browser) {
            await browser.close();
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

    let browser;
    try {
        log.info(`Deleting notebook ${notebookId} via browser...`);

        const { CONFIG } = await import('../config.js');
        browser = await chromium.launch({
            headless: true,
            args: [`--window-size=${CONFIG.viewport.width},${CONFIG.viewport.height}`],
        });
        const context = await browser.newContext({
            storageState: statePath,
            viewport: CONFIG.viewport,
        });
        const page = await context.newPage();

        // Navigate to notebook
        const notebookUrl = `https://notebooklm.google.com/notebook/${notebookId}`;
        await page.goto(notebookUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await randomDelay(1000, 2000);

        // Click settings/more menu
        const menuSelectors = [
            'button[aria-label*="Settings"]',
            'button[aria-label*="More"]',
            'button:has-text("⋮")',
            '[aria-label*="menu"]',
            'button:has([data-icon="more_vert"])',
        ];

        let menuOpened = false;
        for (const sel of menuSelectors) {
            try {
                const menuBtn = page.locator(sel).first();
                if (await menuBtn.isVisible({ timeout: 2000 })) {
                    await menuBtn.click();
                    await randomDelay(500, 800);
                    menuOpened = true;
                    break;
                }
            } catch {
                continue;
            }
        }

        if (!menuOpened) {
            return { success: false, error: 'Could not find settings/menu button', notebookId };
        }

        // Click delete option
        const deleteSelectors = [
            'button:has-text("Delete")',
            '[role="menuitem"]:has-text("Delete")',
            'button:has-text("Remove")',
        ];

        let deleteClicked = false;
        for (const sel of deleteSelectors) {
            try {
                const deleteBtn = page.locator(sel).first();
                if (await deleteBtn.isVisible({ timeout: 2000 })) {
                    await deleteBtn.click();
                    await randomDelay(500, 800);
                    deleteClicked = true;
                    break;
                }
            } catch {
                continue;
            }
        }

        if (!deleteClicked) {
            return { success: false, error: 'Could not find delete option in menu', notebookId };
        }

        // Confirm deletion in dialog
        const confirmSelectors = [
            'button:has-text("Delete")',
            'button:has-text("Confirm")',
            'button:has-text("Yes")',
            '.confirm-button',
        ];

        for (const sel of confirmSelectors) {
            try {
                const confirmBtn = page.locator(sel).first();
                if (await confirmBtn.isVisible({ timeout: 3000 })) {
                    await confirmBtn.click();
                    await randomDelay(1000, 2000);
                    break;
                }
            } catch {
                continue;
            }
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
        if (browser) {
            await browser.close();
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

    let browser;
    try {
        log.info(`Uploading file to notebook ${notebookId}: ${path.basename(filePath)}`);

        const { CONFIG } = await import('../config.js');
        browser = await chromium.launch({
            headless: true,
            args: [`--window-size=${CONFIG.viewport.width},${CONFIG.viewport.height}`],
        });
        const context = await browser.newContext({
            storageState: statePath,
            viewport: CONFIG.viewport,
        });
        const page = await context.newPage();

        // Navigate to notebook
        const notebookUrl = `https://notebooklm.google.com/notebook/${notebookId}`;
        await page.goto(notebookUrl, { waitUntil: 'networkidle', timeout: 30000 });

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
        if (browser) {
            await browser.close();
        }
    }
}
