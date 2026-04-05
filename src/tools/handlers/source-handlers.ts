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
     * Build notebook URL from ID
     */
    function buildNotebookUrl(notebookId: string): string {
        return `https://notebooklm.google.com/notebook/${notebookId}`;
    }

    /**
     * Get notebook ID, using active notebook if not specified
     */
    function resolveNotebookId(notebookId?: string): string | null {
        if (notebookId) {
            return notebookId;
        }

        const activeNotebook = library.getActiveNotebook();
        if (!activeNotebook) {
            log.warning('⚠️  No notebook specified and no active notebook selected');
            return null;
        }

        return activeNotebook.id;
    }

    /**
     * Handle list_sources tool
     */
    async function handleListSources(
        args: { notebook_id?: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookId = resolveNotebookId(args.notebook_id);
        if (!notebookId) {
            return {
                success: false,
                error: 'No notebook specified and no active notebook selected',
            };
        }

        if (sendProgress) {
            await sendProgress('📚 Listing sources...');
        }

        // Try API first
        const result = await sourceOps.listSources(notebookId);

        // Fallback to browser if API fails and sessionManager available
        if (!result.success && sessionManager) {
            log.warning('⚠️  API failed, falling back to browser automation...');
            if (sendProgress) {
                await sendProgress('🔄 API failed, trying browser automation...');
            }

            try {
                const notebookUrl = buildNotebookUrl(notebookId);
                const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);
                const sources = await session.listSourcesViaUI();

                log.success(`✅ Found ${sources.length} sources via browser automation`);
                if (sendProgress) {
                    await sendProgress(`✅ Found ${sources.length} sources via browser`);
                }
                return {
                    success: true,
                    sources: sources.map(s => ({
                        title: s.title,
                        id: s.id,
                    })),
                    method: 'browser',
                };
            } catch (browserError) {
                log.error(`❌ Browser fallback failed: ${browserError}`);
            }
        }

        if (result.success && sendProgress) {
            await sendProgress(`✅ Found ${result.sources?.length || 0} sources`);
        }

        return result;
    }

    /**
     * Handle add_url_source tool
     */
    async function handleAddURLSource(
        args: { notebook_id?: string; url: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookId = resolveNotebookId(args.notebook_id);
        if (!notebookId) {
            return {
                success: false,
                error: 'No notebook specified and no active notebook selected',
            };
        }

        if (sendProgress) {
            await sendProgress(`🔗 Adding URL source: ${args.url}`);
        }

        // Try API first
        const result = await sourceOps.addURLSource(notebookId, args.url);

        // Fallback to browser if API fails and sessionManager available
        if (!result.success && sessionManager) {
            log.warning('⚠️  API failed, falling back to browser automation...');
            if (sendProgress) {
                await sendProgress('🔄 API failed, trying browser automation...');
            }

            try {
                const notebookUrl = buildNotebookUrl(notebookId);
                const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);
                const browserSuccess = await session.addURLSourceViaUI(args.url);

                if (browserSuccess) {
                    log.success('✅ URL source added via browser automation');
                    if (sendProgress) {
                        await sendProgress('✅ URL source added via browser');
                    }
                    return { success: true, notebookId, method: 'browser' };
                }
            } catch (browserError) {
                log.error(`❌ Browser fallback failed: ${browserError}`);
            }
        }

        if (result.success && sendProgress) {
            await sendProgress('✅ URL source added successfully');
        }

        return result;
    }

    /**
     * Handle add_text_source tool
     */
    async function handleAddTextSource(
        args: { notebook_id?: string; title: string; content: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookId = resolveNotebookId(args.notebook_id);
        if (!notebookId) {
            return {
                success: false,
                error: 'No notebook specified and no active notebook selected',
            };
        }

        if (sendProgress) {
            await sendProgress(`📝 Adding text source: ${args.title}`);
        }

        // Try API first
        const result = await sourceOps.addTextSource(
            notebookId,
            args.title,
            args.content
        );

        // Fallback to browser if API fails and sessionManager available
        if (!result.success && sessionManager) {
            log.warning('⚠️  API failed, falling back to browser automation...');
            if (sendProgress) {
                await sendProgress('🔄 API failed, trying browser automation...');
            }

            try {
                const notebookUrl = buildNotebookUrl(notebookId);
                const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);
                const browserSuccess = await session.addTextSourceViaUI(args.title, args.content);

                if (browserSuccess) {
                    log.success('✅ Text source added via browser automation');
                    if (sendProgress) {
                        await sendProgress('✅ Text source added via browser');
                    }
                    return { success: true, notebookId, method: 'browser' };
                }
            } catch (browserError) {
                log.error(`❌ Browser fallback failed: ${browserError}`);
            }
        }

        if (result.success && sendProgress) {
            await sendProgress('✅ Text source added successfully');
        }

        return result;
    }

    /**
     * Handle add_youtube_source tool
     */
    async function handleAddYouTubeSource(
        args: { notebook_id?: string; youtube_url: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookId = resolveNotebookId(args.notebook_id);
        if (!notebookId) {
            return {
                success: false,
                error: 'No notebook specified and no active notebook selected',
            };
        }

        if (sendProgress) {
            await sendProgress(`🎥 Adding YouTube source: ${args.youtube_url}`);
        }

        // Try API first
        const result = await sourceOps.addYouTubeSource(notebookId, args.youtube_url);

        // Fallback to browser if API fails and sessionManager available
        if (!result.success && sessionManager) {
            log.warning('⚠️  API failed, falling back to browser automation...');
            if (sendProgress) {
                await sendProgress('🔄 API failed, trying browser automation...');
            }

            try {
                const notebookUrl = buildNotebookUrl(notebookId);
                const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);
                const browserSuccess = await session.addYouTubeSourceViaUI(args.youtube_url);

                if (browserSuccess) {
                    log.success('✅ YouTube source added via browser automation');
                    if (sendProgress) {
                        await sendProgress('✅ YouTube source added via browser');
                    }
                    return { success: true, notebookId, method: 'browser' };
                }
            } catch (browserError) {
                log.error(`❌ Browser fallback failed: ${browserError}`);
            }
        }

        if (result.success && sendProgress) {
            await sendProgress('✅ YouTube source added successfully');
        }

        return result;
    }

    /**
     * Handle add_drive_source tool
     */
    async function handleAddDriveSource(
        args: { notebook_id?: string; file_id: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookId = resolveNotebookId(args.notebook_id);
        if (!notebookId) {
            return {
                success: false,
                error: 'No notebook specified and no active notebook selected',
            };
        }

        if (sendProgress) {
            await sendProgress(`📁 Adding Google Drive source: ${args.file_id}`);
        }

        const result = await sourceOps.addDriveSource(notebookId, args.file_id);

        if (result.success && sendProgress) {
            await sendProgress('✅ Google Drive source added successfully');
        }

        return result;
    }

    /**
     * Handle delete_source tool
     */
    async function handleDeleteSource(
        args: { notebook_id?: string; source_id: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookId = resolveNotebookId(args.notebook_id);
        if (!notebookId) {
            return {
                success: false,
                error: 'No notebook specified and no active notebook selected',
            };
        }

        if (sendProgress) {
            await sendProgress(`🗑️  Deleting source: ${args.source_id}`);
        }

        const result = await sourceOps.deleteSource(notebookId, args.source_id);

        if (result.success && sendProgress) {
            await sendProgress('✅ Source deleted successfully');
        }

        return result;
    }

    /**
     * Handle summarize_source tool
     */
    async function handleSummarizeSource(
        args: { notebook_id?: string; source_id: string },
        sendProgress?: ProgressCallback
    ) {
        const notebookId = resolveNotebookId(args.notebook_id);
        if (!notebookId) {
            return {
                success: false,
                error: 'No notebook specified and no active notebook selected',
            };
        }

        if (sendProgress) {
            await sendProgress(`📄 Getting source summary: ${args.source_id}`);
        }

        const result = await sourceOps.summarizeSource(notebookId, args.source_id);

        if (result.success && sendProgress) {
            await sendProgress('✅ Source summary retrieved');
        }

        return result;
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
