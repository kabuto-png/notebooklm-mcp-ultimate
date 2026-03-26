/**
 * Notebook CRUD Tool Handlers
 *
 * Implements handlers for notebook create/rename/delete tools.
 */

import type { NotebookLibrary } from '../../library/notebook-library.js';
import type { ProgressCallback } from '../../types.js';
import { log } from '../../utils/logger.js';
import * as notebookOps from '../../operations/notebook-crud-operations.js';

/**
 * Dependencies for notebook CRUD handlers
 */
export interface NotebookCRUDHandlerDependencies {
    library: NotebookLibrary;
}

/**
 * Notebook CRUD handlers type
 */
export type NotebookCRUDHandlers = ReturnType<typeof createNotebookCRUDHandlers>;

/**
 * Create notebook CRUD handlers
 */
export function createNotebookCRUDHandlers(deps: NotebookCRUDHandlerDependencies) {
    const { library } = deps;

    /**
     * Handle create_notebook_remote tool
     */
    async function handleCreateNotebookRemote(
        args: { title?: string },
        sendProgress?: ProgressCallback
    ) {
        if (sendProgress) {
            await sendProgress('Creating notebook in NotebookLM...');
        }

        const result = await notebookOps.createNotebook(args.title);

        if (result.success && sendProgress) {
            await sendProgress(`Notebook created: ${result.title}`);
        }

        return {
            success: result.success,
            data: result.success ? {
                notebook_id: result.notebookId,
                title: result.title,
                url: result.url,
                message: `Notebook "${result.title}" created successfully`,
            } : undefined,
            error: result.error,
        };
    }

    /**
     * Handle rename_notebook_remote tool
     */
    async function handleRenameNotebookRemote(
        args: { notebook_id: string; new_title: string },
        sendProgress?: ProgressCallback
    ) {
        if (sendProgress) {
            await sendProgress(`Renaming notebook to "${args.new_title}"...`);
        }

        const result = await notebookOps.renameNotebook(args.notebook_id, args.new_title);

        if (result.success && sendProgress) {
            await sendProgress(`Notebook renamed to: ${args.new_title}`);
        }

        return {
            success: result.success,
            data: result.success ? {
                notebook_id: result.notebookId,
                title: result.title,
                message: `Notebook renamed to "${result.title}"`,
            } : undefined,
            error: result.error,
        };
    }

    /**
     * Handle delete_notebook_remote tool
     */
    async function handleDeleteNotebookRemote(
        args: { notebook_id: string },
        sendProgress?: ProgressCallback
    ) {
        if (sendProgress) {
            await sendProgress('Deleting notebook from NotebookLM...');
        }

        const result = await notebookOps.deleteNotebookRemote(args.notebook_id);

        if (result.success) {
            // Also remove from local library if it exists
            try {
                const removed = library.removeNotebook(args.notebook_id);
                if (removed) {
                    log.info(`Also removed notebook from local library`);
                }
            } catch (libraryError) {
                log.warning(`Failed to remove from local library: ${libraryError}`);
                // Don't fail the operation - remote delete succeeded
            }

            if (sendProgress) {
                await sendProgress('Notebook deleted permanently');
            }
        }

        return {
            success: result.success,
            data: result.success ? {
                notebook_id: result.notebookId,
                message: 'Notebook deleted permanently from NotebookLM',
            } : undefined,
            error: result.error,
        };
    }

    /**
     * Handle add_file_source tool
     */
    async function handleAddFileSource(
        args: { notebook_id: string; file_path: string },
        sendProgress?: ProgressCallback
    ) {
        if (sendProgress) {
            await sendProgress(`Uploading file: ${args.file_path}...`);
        }

        const result = await notebookOps.addFileSource(args.notebook_id, args.file_path);

        if (result.success && sendProgress) {
            await sendProgress(`File uploaded: ${result.title}`);
        }

        return {
            success: result.success,
            data: result.success ? {
                notebook_id: result.notebookId,
                file_name: result.title,
                message: `File "${result.title}" uploaded successfully`,
            } : undefined,
            error: result.error,
        };
    }

    return {
        handleCreateNotebookRemote,
        handleRenameNotebookRemote,
        handleDeleteNotebookRemote,
        handleAddFileSource,
    };
}
