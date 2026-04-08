/**
 * Source Management Tool Handlers
 *
 * Implements handlers for source management tools.
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
     * Resolve notebook to its actual URL (browser needs full URL with UUID, not alias)
     */
    function resolveNotebookUrl(notebookId?: string): string | null {
        // If UUID provided directly, build URL
        if (notebookId && /^[a-f0-9-]{36}$/i.test(notebookId)) {
            return `https://notebooklm.google.com/notebook/${notebookId}`;
        }

        // Get notebook from library (by alias or active)
        const notebook = notebookId
            ? library.getNotebook(notebookId)
            : library.getActiveNotebook();

        if (!notebook) {
            log.warning('⚠️  No notebook specified and no active notebook selected');
            return null;
        }

        // Return stored URL (contains actual UUID)
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

        if (sendProgress) {
            await sendProgress('📚 Listing sources via browser...');
        }

        try {
            const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);
            const sources = await session.listSourcesViaUI();

            log.success(`✅ Found ${sources.length} sources via browser`);
            if (sendProgress) {
                await sendProgress(`✅ Found ${sources.length} sources`);
            }
            return {
                success: true,
                sources: sources.map(s => ({ title: s.title, id: s.id })),
                method: 'browser',
                notebookId: notebookAlias,
            };
        } catch (error) {
            log.error(`❌ Browser failed: ${error}`);
            return {
                success: false,
                error: `Browser failed: ${error}`,
                notebookId: notebookAlias,
            };
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

        if (sendProgress) await sendProgress(`🔗 Adding URL source: ${args.url}`);

        try {
            const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);
            const success = await session.addURLSourceViaUI(args.url);

            if (success) {
                log.success('✅ URL source added via browser');
                if (sendProgress) await sendProgress('✅ URL source added');
                return { success: true, notebookId: notebookAlias, method: 'browser' };
            }
            return { success: false, error: 'Browser failed to add URL source', notebookId: notebookAlias };
        } catch (error) {
            log.error(`❌ Browser failed: ${error}`);
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

        if (sendProgress) await sendProgress(`📝 Adding text source: ${args.title}`);

        try {
            const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);
            const success = await session.addTextSourceViaUI(args.title, args.content);

            if (success) {
                log.success('✅ Text source added via browser');
                if (sendProgress) await sendProgress('✅ Text source added');
                return { success: true, notebookId: notebookAlias, method: 'browser' };
            }
            return { success: false, error: 'Browser failed to add text source', notebookId: notebookAlias };
        } catch (error) {
            log.error(`❌ Browser failed: ${error}`);
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

        if (sendProgress) await sendProgress(`🎥 Adding YouTube source: ${args.youtube_url}`);

        try {
            const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);
            const success = await session.addYouTubeSourceViaUI(args.youtube_url);

            if (success) {
                log.success('✅ YouTube source added via browser');
                if (sendProgress) await sendProgress('✅ YouTube source added');
                return { success: true, notebookId: notebookAlias, method: 'browser' };
            }
            return { success: false, error: 'Browser failed to add YouTube source', notebookId: notebookAlias };
        } catch (error) {
            log.error(`❌ Browser failed: ${error}`);
            return { success: false, error: `Browser failed: ${error}`, notebookId: notebookAlias };
        }
    }

    /**
     * Handle add_drive_source tool (API-only, no browser equivalent yet)
     */
    async function handleAddDriveSource(
        args: { notebook_id?: string; file_id: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookAlias = resolveNotebookAlias(args.notebook_id);
        // Drive source requires file picker - keep API for now
        // TODO: Implement browser-based Drive file picker if needed

        if (sendProgress) await sendProgress(`📁 Adding Google Drive source: ${args.file_id}`);

        // Extract UUID from library for API call
        const notebook = args.notebook_id
            ? library.getNotebook(args.notebook_id)
            : library.getActiveNotebook();

        if (!notebook?.url) {
            return { success: false, error: 'No notebook specified', notebookId: notebookAlias };
        }

        const uuidMatch = notebook.url.match(/\/notebook\/([a-f0-9-]+)/i);
        if (!uuidMatch) {
            return { success: false, error: 'Could not extract notebook UUID', notebookId: notebookAlias };
        }

        const result = await sourceOps.addDriveSource(uuidMatch[1], args.file_id);
        if (result.success && sendProgress) await sendProgress('✅ Google Drive source added');
        return { ...result, notebookId: notebookAlias };
    }

    /**
     * Handle delete_source tool (API-only for now)
     */
    async function handleDeleteSource(
        args: { notebook_id?: string; source_id: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookAlias = resolveNotebookAlias(args.notebook_id);

        if (sendProgress) await sendProgress(`🗑️  Deleting source: ${args.source_id}`);

        // Handle UUID directly or lookup from library
        let notebookUuid: string | undefined;
        if (args.notebook_id?.match(/^[a-f0-9-]{36}$/i)) {
            notebookUuid = args.notebook_id;
        } else {
            const notebook = args.notebook_id
                ? library.getNotebook(args.notebook_id)
                : library.getActiveNotebook();
            const uuidMatch = notebook?.url?.match(/\/notebook\/([a-f0-9-]+)/i);
            notebookUuid = uuidMatch?.[1];
        }

        if (!notebookUuid) {
            return { success: false, error: 'No notebook specified', notebookId: notebookAlias ?? undefined };
        }

        const result = await sourceOps.deleteSource(notebookUuid, args.source_id);
        if (result.success && sendProgress) await sendProgress('✅ Source deleted');
        return { ...result, notebookId: notebookAlias ?? undefined };
    }

    /**
     * Handle summarize_source tool (API-only)
     */
    async function handleSummarizeSource(
        args: { notebook_id?: string; source_id: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookAlias = resolveNotebookAlias(args.notebook_id);

        // Handle UUID directly or lookup from library
        let notebookUuid: string | undefined;
        if (args.notebook_id?.match(/^[a-f0-9-]{36}$/i)) {
            notebookUuid = args.notebook_id;
        } else {
            const notebook = args.notebook_id
                ? library.getNotebook(args.notebook_id)
                : library.getActiveNotebook();
            const uuidMatch = notebook?.url?.match(/\/notebook\/([a-f0-9-]+)/i);
            notebookUuid = uuidMatch?.[1];
        }

        if (!notebookUuid) {
            return { success: false, error: 'No notebook specified', notebookId: notebookAlias ?? undefined };
        }

        if (sendProgress) await sendProgress(`📄 Getting source summary: ${args.source_id}`);

        const result = await sourceOps.summarizeSource(notebookUuid, args.source_id);
        if (result.success && sendProgress) await sendProgress('✅ Source summary retrieved');
        return { ...result, notebookId: notebookAlias ?? undefined };
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
