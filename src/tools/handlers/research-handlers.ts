/**
 * Research Tool Handlers
 *
 * Implements handlers for research and source discovery tools.
 */

import type { NotebookLibrary } from '../../library/notebook-library.js';
import type { ProgressCallback } from '../../types.js';
import { log } from '../../utils/logger.js';
import * as researchOps from '../../operations/research-operations.js';

/**
 * Dependencies for research handlers
 */
export interface ResearchHandlerDependencies {
    library: NotebookLibrary;
}

/**
 * Research handlers type
 */
export type ResearchHandlers = ReturnType<typeof createResearchHandlers>;

/**
 * Create research handlers
 */
export function createResearchHandlers(deps: ResearchHandlerDependencies) {
    const { library } = deps;

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
     * Handle discover_sources tool
     */
    async function handleDiscoverSources(
        args: { topic: string; notebook_id?: string },
        sendProgress?: ProgressCallback
    ) {
        if (sendProgress) {
            await sendProgress(`🔍 Discovering sources for: ${args.topic}`);
        }

        const notebookId = resolveNotebookId(args.notebook_id);
        const result = await researchOps.discoverSources(args.topic, notebookId || undefined);

        if (result.success && sendProgress) {
            await sendProgress(`✅ Found ${result.suggestions?.length || 0} search queries`);
        }

        return result;
    }

    /**
     * Handle import_source tool
     */
    async function handleImportSource(
        args: { url: string; notebook_id?: string },
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
            await sendProgress(`📥 Importing source: ${args.url}`);
        }

        const result = await researchOps.importSource(args.url, notebookId);

        if (result.success && sendProgress) {
            await sendProgress('✅ Source imported successfully');
        }

        return result;
    }

    /**
     * Handle research_topic tool
     */
    async function handleResearchTopic(
        args: { topic: string; notebook_id?: string; auto_import?: boolean },
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
            await sendProgress(`📚 Researching topic: ${args.topic}`);
        }

        const result = await researchOps.researchTopic(
            args.topic,
            notebookId,
            args.auto_import || false
        );

        if (result.success && sendProgress) {
            await sendProgress('✅ Research complete');
        }

        return result;
    }

    return {
        handleDiscoverSources,
        handleImportSource,
        handleResearchTopic,
    };
}
