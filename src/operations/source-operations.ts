/**
 * Source Management Operations for NotebookLM
 *
 * Provides high-level operations for managing sources in notebooks
 * using the NotebookLM API.
 *
 * Supported operations:
 * - List sources
 * - Add URL source
 * - Add text/paste source
 * - Add YouTube video source
 * - Add Google Drive file source
 * - Delete source
 * - Summarize source
 */

import { getAPIClient, type NotebookLMAPIClient } from '../api/index.js';
import { initializeAPIClientWithCookies } from '../auth/cookie-store.js';
import { log } from '../utils/logger.js';
import type { APISource } from '../api/types.js';

/**
 * Result of a source operation
 */
export interface SourceOperationResult {
    success: boolean;
    sources?: APISource[];
    source?: APISource;
    sourceId?: string;
    error?: string;
    notebookId?: string;
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
        log.warning('⚠️  Failed to initialize API client. Please run setup_auth.');
        return null;
    }

    return client;
}

/**
 * List all sources in a notebook
 */
export async function listSources(
    notebookId: string
): Promise<SourceOperationResult> {
    const client = await getInitializedClient();
    if (!client) {
        return {
            success: false,
            error: 'API client not initialized. Please run setup_auth first.',
        };
    }

    try {
        log.info(`📚 Listing sources for notebook ${notebookId}...`);

        const sources = await client.listSources(notebookId);

        return {
            success: true,
            sources,
            notebookId,
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to list sources: ${error}`,
            notebookId,
        };
    }
}

/**
 * Add a URL source to a notebook
 */
export async function addURLSource(
    notebookId: string,
    url: string
): Promise<SourceOperationResult> {
    const client = await getInitializedClient();
    if (!client) {
        return {
            success: false,
            error: 'API client not initialized. Please run setup_auth first.',
        };
    }

    try {
        log.info(`🔗 Adding URL source to notebook ${notebookId}: ${url}`);

        const success = await client.addURLSource(notebookId, url);

        if (!success) {
            return {
                success: false,
                error: 'Failed to add URL source',
                notebookId,
            };
        }

        return {
            success: true,
            notebookId,
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to add URL source: ${error}`,
            notebookId,
        };
    }
}

/**
 * Add a text/paste source to a notebook
 */
export async function addTextSource(
    notebookId: string,
    title: string,
    content: string
): Promise<SourceOperationResult> {
    const client = await getInitializedClient();
    if (!client) {
        return {
            success: false,
            error: 'API client not initialized. Please run setup_auth first.',
        };
    }

    try {
        log.info(`📝 Adding text source to notebook ${notebookId}: ${title}`);

        const success = await client.addTextSource(notebookId, title, content);

        if (!success) {
            return {
                success: false,
                error: 'Failed to add text source',
                notebookId,
            };
        }

        return {
            success: true,
            notebookId,
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to add text source: ${error}`,
            notebookId,
        };
    }
}

/**
 * Add a YouTube video source to a notebook
 */
export async function addYouTubeSource(
    notebookId: string,
    youtubeUrl: string
): Promise<SourceOperationResult> {
    const client = await getInitializedClient();
    if (!client) {
        return {
            success: false,
            error: 'API client not initialized. Please run setup_auth first.',
        };
    }

    try {
        log.info(`🎥 Adding YouTube source to notebook ${notebookId}: ${youtubeUrl}`);

        const success = await client.addYouTubeSource(notebookId, youtubeUrl);

        if (!success) {
            return {
                success: false,
                error: 'Failed to add YouTube source',
                notebookId,
            };
        }

        return {
            success: true,
            notebookId,
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to add YouTube source: ${error}`,
            notebookId,
        };
    }
}

/**
 * Add a Google Drive file source to a notebook
 */
export async function addDriveSource(
    notebookId: string,
    fileId: string
): Promise<SourceOperationResult> {
    const client = await getInitializedClient();
    if (!client) {
        return {
            success: false,
            error: 'API client not initialized. Please run setup_auth first.',
        };
    }

    try {
        log.info(`📁 Adding Google Drive source to notebook ${notebookId}: ${fileId}`);

        const success = await client.addDriveSource(notebookId, fileId);

        if (!success) {
            return {
                success: false,
                error: 'Failed to add Google Drive source',
                notebookId,
            };
        }

        return {
            success: true,
            notebookId,
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to add Google Drive source: ${error}`,
            notebookId,
        };
    }
}

/**
 * Delete a source from a notebook
 */
export async function deleteSource(
    notebookId: string,
    sourceId: string
): Promise<SourceOperationResult> {
    const client = await getInitializedClient();
    if (!client) {
        return {
            success: false,
            error: 'API client not initialized. Please run setup_auth first.',
        };
    }

    try {
        log.info(`🗑️  Deleting source ${sourceId} from notebook ${notebookId}...`);

        const success = await client.deleteSource(notebookId, sourceId);

        if (!success) {
            return {
                success: false,
                error: 'Failed to delete source',
                notebookId,
                sourceId,
            };
        }

        return {
            success: true,
            notebookId,
            sourceId,
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to delete source: ${error}`,
            notebookId,
            sourceId,
        };
    }
}

/**
 * Get summary/details of a specific source
 * 
 * Note: This returns the source metadata from the list.
 * For full content summary, use content generation tools.
 */
export async function summarizeSource(
    notebookId: string,
    sourceId: string
): Promise<SourceOperationResult> {
    const client = await getInitializedClient();
    if (!client) {
        return {
            success: false,
            error: 'API client not initialized. Please run setup_auth first.',
        };
    }

    try {
        log.info(`📄 Getting summary for source ${sourceId} in notebook ${notebookId}...`);

        // Get all sources and find the specific one
        const sources = await client.listSources(notebookId);
        const source = sources.find(s => s.id === sourceId);

        if (!source) {
            return {
                success: false,
                error: `Source ${sourceId} not found in notebook`,
                notebookId,
                sourceId,
            };
        }

        return {
            success: true,
            source,
            notebookId,
            sourceId,
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get source summary: ${error}`,
            notebookId,
            sourceId,
        };
    }
}
