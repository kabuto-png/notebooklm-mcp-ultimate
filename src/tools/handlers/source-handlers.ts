/**
 * Source Management Tool Handlers
 *
 * Browser-only implementations for source management.
 * Only addDriveSource uses API (requires Drive picker).
 */

import type { NotebookLibrary } from '../../library/notebook-library.js';
import type { SessionManager } from '../../session/session-manager.js';
import type { ProgressCallback } from '../../types.js';
import { log } from '../../utils/logger.js';
import * as sourceOps from '../../operations/source-operations.js';

/**
 * Dependencies for source handlers
 */
export interface SourceHandlerDependencies {
    library: NotebookLibrary;
    sessionManager?: SessionManager;
}

/**
 * Source handlers type
 */
export type SourceHandlers = ReturnType<typeof createSourceHandlers>;

/**
 * Create source management handlers
 */
export function createSourceHandlers(deps: SourceHandlerDependencies) {
    const { library, sessionManager } = deps;

    /**
     * UUID regex pattern
     */
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    /**
     * Extract notebook UUID from URL
     */
    function extractUuidFromUrl(url: string): string | null {
        const match = url.match(/\/notebook\/([0-9a-f-]{36})/i);
        return match ? match[1] : null;
    }

    /**
     * Resolve notebook to full URL (browser needs full URL)
     */
    function resolveNotebookUrl(notebookId?: string): string | null {
        // If UUID provided directly, build URL
        if (notebookId && UUID_PATTERN.test(notebookId)) {
            return `https://notebooklm.google.com/notebook/${notebookId}`;
        }

        // Get notebook from library (by alias or active)
        const notebook = notebookId
            ? library.getNotebook(notebookId)
            : library.getActiveNotebook();

        if (!notebook) {
            log.warning('No notebook specified and no active notebook selected');
            return null;
        }

        return notebook.url;
    }

    /**
     * Get notebook alias for user-facing responses
     */
    function resolveNotebookAlias(notebookId?: string): string | null {
        if (notebookId) {
            const notebook = library.getNotebook(notebookId);
            return notebook?.id || notebookId;
        }
        return library.getActiveNotebook()?.id || null;
    }

    /**
     * Resolve notebook ID to UUID (for API calls)
     */
    function resolveNotebookUuid(notebookId?: string): string | null {
        if (notebookId && UUID_PATTERN.test(notebookId)) {
            return notebookId;
        }

        const notebook = notebookId
            ? library.getNotebook(notebookId)
            : library.getActiveNotebook();

        if (!notebook) {
            return null;
        }

        return extractUuidFromUrl(notebook.url);
    }

    /**
     * Handle list_sources tool (browser-only)
     */
    async function handleListSources(
        args: { notebook_id?: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookUrl = resolveNotebookUrl(args.notebook_id);
        const notebookAlias = resolveNotebookAlias(args.notebook_id);

        if (!notebookUrl) {
            return {
                success: false,
                error: 'No notebook specified and no active notebook selected',
            };
        }

        if (!sessionManager) {
            return {
                success: false,
                error: 'Browser session manager not available',
                notebookId: notebookAlias,
            };
        }

        if (sendProgress) await sendProgress('Listing sources via browser...');

        try {
            const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);
            const sources = await session.listSourcesViaUI();

            log.success(`Found ${sources.length} sources via browser`);
            if (sendProgress) await sendProgress(`Found ${sources.length} sources`);

            return {
                success: true,
                sources: sources.map(s => ({ title: s.title, id: s.id })),
                method: 'browser',
                notebookId: notebookAlias,
            };
        } catch (error) {
            log.error(`Browser failed: ${error}`);
            return { success: false, error: `Browser failed: ${error}`, notebookId: notebookAlias };
        }
    }

    /**
     * Handle add_url_source tool (browser-only)
     */
    async function handleAddURLSource(
        args: { notebook_id?: string; url: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookUrl = resolveNotebookUrl(args.notebook_id);
        const notebookAlias = resolveNotebookAlias(args.notebook_id);

        if (!notebookUrl || !sessionManager) {
            return {
                success: false,
                error: !notebookUrl ? 'No notebook specified' : 'Browser session not available',
                notebookId: notebookAlias,
            };
        }

        if (sendProgress) await sendProgress(`Adding URL source: ${args.url}`);

        try {
            const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);
            const success = await session.addURLSourceViaUI(args.url);

            if (success) {
                log.success('URL source added via browser');
                if (sendProgress) await sendProgress('URL source added');
                return { success: true, notebookId: notebookAlias, method: 'browser' };
            }
            return { success: false, error: 'Browser failed to add URL source', notebookId: notebookAlias };
        } catch (error) {
            log.error(`Browser failed: ${error}`);
            return { success: false, error: `Browser failed: ${error}`, notebookId: notebookAlias };
        }
    }

    /**
     * Handle add_text_source tool (browser-only)
     */
    async function handleAddTextSource(
        args: { notebook_id?: string; title: string; content: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookUrl = resolveNotebookUrl(args.notebook_id);
        const notebookAlias = resolveNotebookAlias(args.notebook_id);

        if (!notebookUrl || !sessionManager) {
            return {
                success: false,
                error: !notebookUrl ? 'No notebook specified' : 'Browser session not available',
                notebookId: notebookAlias,
            };
        }

        if (sendProgress) await sendProgress(`Adding text source: ${args.title}`);

        try {
            const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);
            const success = await session.addTextSourceViaUI(args.title, args.content);

            if (success) {
                log.success('Text source added via browser');
                if (sendProgress) await sendProgress('Text source added');
                return { success: true, notebookId: notebookAlias, method: 'browser' };
            }
            return { success: false, error: 'Browser failed to add text source', notebookId: notebookAlias };
        } catch (error) {
            log.error(`Browser failed: ${error}`);
            return { success: false, error: `Browser failed: ${error}`, notebookId: notebookAlias };
        }
    }

    /**
     * Handle add_youtube_source tool (browser-only)
     */
    async function handleAddYouTubeSource(
        args: { notebook_id?: string; youtube_url: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookUrl = resolveNotebookUrl(args.notebook_id);
        const notebookAlias = resolveNotebookAlias(args.notebook_id);

        if (!notebookUrl || !sessionManager) {
            return {
                success: false,
                error: !notebookUrl ? 'No notebook specified' : 'Browser session not available',
                notebookId: notebookAlias,
            };
        }

        if (sendProgress) await sendProgress(`Adding YouTube source: ${args.youtube_url}`);

        try {
            const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);
            const success = await session.addYouTubeSourceViaUI(args.youtube_url);

            if (success) {
                log.success('YouTube source added via browser');
                if (sendProgress) await sendProgress('YouTube source added');
                return { success: true, notebookId: notebookAlias, method: 'browser' };
            }
            return { success: false, error: 'Browser failed to add YouTube source', notebookId: notebookAlias };
        } catch (error) {
            log.error(`Browser failed: ${error}`);
            return { success: false, error: `Browser failed: ${error}`, notebookId: notebookAlias };
        }
    }

    /**
     * Handle add_drive_source tool (API-only - requires Drive picker)
     */
    async function handleAddDriveSource(
        args: { notebook_id?: string; file_id: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookUuid = resolveNotebookUuid(args.notebook_id);
        const notebookAlias = resolveNotebookAlias(args.notebook_id);

        if (!notebookUuid) {
            return {
                success: false,
                error: 'No notebook specified and no active notebook selected',
                notebookId: notebookAlias,
            };
        }

        if (sendProgress) await sendProgress(`Adding Google Drive source: ${args.file_id}`);

        const result = await sourceOps.addDriveSource(notebookUuid, args.file_id);
        if (result.success && sendProgress) await sendProgress('Google Drive source added');

        return { ...result, notebookId: notebookAlias };
    }

    /**
     * Handle delete_source tool (browser-only)
     */
    async function handleDeleteSource(
        args: { notebook_id?: string; source_id: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookUrl = resolveNotebookUrl(args.notebook_id);
        const notebookAlias = resolveNotebookAlias(args.notebook_id);

        if (!notebookUrl || !sessionManager) {
            return {
                success: false,
                error: !notebookUrl ? 'No notebook specified' : 'Browser session not available',
                notebookId: notebookAlias ?? undefined,
            };
        }

        if (sendProgress) await sendProgress(`Deleting source: ${args.source_id}`);

        try {
            const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);

            // source_id can be title or ID - use as title for browser
            let sourceTitle = args.source_id;

            // If it looks like an API source ID (sources/xxx), find the actual title
            if (args.source_id.startsWith('sources/')) {
                const sources = await session.listSourcesViaUI();
                const match = sources.find(s => s.id?.includes(args.source_id.replace('sources/', '')));
                if (match) sourceTitle = match.title;
            }

            const success = await session.deleteSourceViaUI(sourceTitle, sendProgress);

            if (success) {
                log.success('Source deleted via browser');
                return { success: true, notebookId: notebookAlias ?? undefined, method: 'browser' };
            }
            return { success: false, error: 'Failed to delete source', notebookId: notebookAlias ?? undefined };
        } catch (error) {
            log.error(`Browser failed: ${error}`);
            return { success: false, error: `Browser failed: ${error}`, notebookId: notebookAlias ?? undefined };
        }
    }

    /**
     * Handle summarize_source tool (browser-only)
     */
    async function handleSummarizeSource(
        args: { notebook_id?: string; source_id: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookUrl = resolveNotebookUrl(args.notebook_id);
        const notebookAlias = resolveNotebookAlias(args.notebook_id);

        if (!notebookUrl || !sessionManager) {
            return {
                success: false,
                error: !notebookUrl ? 'No notebook specified' : 'Browser session not available',
                notebookId: notebookAlias ?? undefined,
            };
        }

        if (sendProgress) await sendProgress(`Getting source details: ${args.source_id}`);

        try {
            const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);

            // source_id can be title or ID - use as title for browser
            let sourceTitle = args.source_id;

            // If it looks like an API source ID (sources/xxx), find the actual title
            if (args.source_id.startsWith('sources/')) {
                const sources = await session.listSourcesViaUI();
                const match = sources.find(s => s.id?.includes(args.source_id.replace('sources/', '')));
                if (match) sourceTitle = match.title;
            }

            const details = await session.getSourceDetailsViaUI(sourceTitle);

            if (details) {
                log.success('Source details retrieved via browser');
                if (sendProgress) await sendProgress('Source details retrieved');
                return {
                    success: true,
                    source: details,
                    notebookId: notebookAlias ?? undefined,
                    method: 'browser',
                };
            }
            return { success: false, error: 'Source not found', notebookId: notebookAlias ?? undefined };
        } catch (error) {
            log.error(`Browser failed: ${error}`);
            return { success: false, error: `Browser failed: ${error}`, notebookId: notebookAlias ?? undefined };
        }
    }

    return {
        handleListSources,
        handleAddURLSource,
        handleAddTextSource,
        handleAddYouTubeSource,
        handleAddDriveSource,
        handleDeleteSource,
        handleSummarizeSource,
    };
}
