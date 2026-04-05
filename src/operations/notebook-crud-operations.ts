/**
 * Notebook CRUD Operations for NotebookLM
 *
 * Provides high-level operations for creating and renaming notebooks
 * directly via the NotebookLM API (not browser automation).
 *
 * Supported operations:
 * - Create notebook
 * - Rename notebook (remote)
 */

import { getAPIClient, type NotebookLMAPIClient } from '../api/index.js';
import { initializeAPIClientWithCookies } from '../auth/cookie-store.js';
import { log } from '../utils/logger.js';
import { chromium } from 'patchright';
import { AuthManager } from '../auth/auth-manager.js';
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
 * Get an initialized API client
 */
async function getInitializedClient(): Promise<NotebookLMAPIClient | null> {
    const client = getAPIClient();

    // Check if already initialized
    if (client.hasValidAuth()) {
        return client;
    }

    // Try to initialize from cookie store
    const success = await initializeAPIClientWithCookies(client);
    if (!success) {
        log.warning('API client not initialized. Please run setup_auth.');
        return null;
    }

    return client;
}

/**
 * Create a new notebook in NotebookLM
 *
 * @param title - Optional title for the notebook (defaults to "Untitled notebook")
 * @returns Result with notebook ID and URL
 */
export async function createNotebook(
    title?: string
): Promise<NotebookCRUDResult> {
    const client = await getInitializedClient();
    if (!client) {
        return {
            success: false,
            error: 'API client not initialized. Please run setup_auth first.',
        };
    }

    try {
        log.info(`Creating notebook${title ? `: ${title}` : ''}...`);

        const notebookId = await client.createNotebook(title);

        if (!notebookId) {
            return {
                success: false,
                error: 'Failed to create notebook - no ID returned',
            };
        }

        const url = `https://notebooklm.google.com/notebook/${notebookId}`;

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
    }
}

/**
 * Rename a notebook in NotebookLM
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

    const client = await getInitializedClient();
    if (!client) {
        return {
            success: false,
            error: 'API client not initialized. Please run setup_auth first.',
        };
    }

    try {
        log.info(`Renaming notebook ${notebookId} to "${newTitle}"...`);

        const success = await client.renameNotebook(notebookId, newTitle);

        if (!success) {
            return {
                success: false,
                error: 'Failed to rename notebook',
                notebookId,
            };
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
    }
}

/**
 * Delete a notebook in NotebookLM
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

    const client = await getInitializedClient();
    if (!client) {
        return {
            success: false,
            error: 'API client not initialized. Please run setup_auth first.',
        };
    }

    try {
        log.info(`Deleting notebook ${notebookId}...`);

        const success = await client.deleteNotebook(notebookId);

        if (!success) {
            return {
                success: false,
                error: 'Failed to delete notebook',
                notebookId,
            };
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

        // Launch browser with saved state
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
