/**
 * Audio Studio Tool Handlers
 *
 * Implements the handler logic for audio studio tools.
 */

import type { NotebookLibrary } from '../../library/notebook-library.js';
import type { ProgressCallback } from '../../types.js';
import {
    getAudioStatus,
    createAudio,
    updateAudio,
    deleteAudio,
    getAudioDownloadURL,
} from '../../operations/studio-operations.js';
import { log } from '../../utils/logger.js';

/**
 * Studio handler dependencies
 */
export interface StudioHandlerDependencies {
    library: NotebookLibrary;
}

/**
 * Create studio handlers with dependencies
 */
export function createStudioHandlers(deps: StudioHandlerDependencies) {
    const { library } = deps;

    /**
     * Get notebook ID, using active notebook if not specified
     */
    async function resolveNotebookId(notebookId?: string): Promise<string | null> {
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

    return {
        /**
         * Handle get_audio_status tool call
         */
        async handleGetAudioStatus(
            args: { notebook_id?: string },
            sendProgress?: ProgressCallback
        ) {
            await sendProgress?.('Resolving notebook...', 1, 3);

            const notebookId = await resolveNotebookId(args.notebook_id);
            if (!notebookId) {
                return {
                    success: false,
                    error: 'No notebook specified. Use notebook_id parameter or select a notebook first.',
                };
            }

            await sendProgress?.('Checking audio status...', 2, 3);

            const result = await getAudioStatus(notebookId);

            await sendProgress?.('Done!', 3, 3);

            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Failed to get audio status',
                };
            }

            return {
                success: true,
                status: result.status,
                audio_url: result.audioUrl,
                duration_seconds: result.durationSeconds,
                transcript: result.transcript,
                progress: result.progress,
                notebook_id: notebookId,
            };
        },

        /**
         * Handle create_audio tool call
         */
        async handleCreateAudio(
            args: {
                notebook_id?: string;
                custom_instructions?: string;
                focus_topics?: string[];
                target_audience?: 'general' | 'expert' | 'student';
            },
            sendProgress?: ProgressCallback
        ) {
            await sendProgress?.('Resolving notebook...', 1, 4);

            const notebookId = await resolveNotebookId(args.notebook_id);
            if (!notebookId) {
                return {
                    success: false,
                    error: 'No notebook specified. Use notebook_id parameter or select a notebook first.',
                };
            }

            await sendProgress?.('Creating audio overview...', 2, 4);

            const result = await createAudio({
                notebookId,
                customInstructions: args.custom_instructions,
                focusTopics: args.focus_topics,
                targetAudience: args.target_audience,
            });

            await sendProgress?.('Audio generation started!', 4, 4);

            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Failed to create audio',
                };
            }

            return {
                success: true,
                status: result.status,
                notebook_id: notebookId,
                message: 'Audio generation started. Use get_audio_status to check progress.',
            };
        },

        /**
         * Handle update_audio tool call
         */
        async handleUpdateAudio(
            args: {
                notebook_id?: string;
                custom_instructions?: string;
                focus_topics?: string[];
                target_audience?: 'general' | 'expert' | 'student';
            },
            sendProgress?: ProgressCallback
        ) {
            await sendProgress?.('Resolving notebook...', 1, 4);

            const notebookId = await resolveNotebookId(args.notebook_id);
            if (!notebookId) {
                return {
                    success: false,
                    error: 'No notebook specified. Use notebook_id parameter or select a notebook first.',
                };
            }

            await sendProgress?.('Updating audio overview...', 2, 4);

            const result = await updateAudio({
                notebookId,
                customInstructions: args.custom_instructions,
                focusTopics: args.focus_topics,
                targetAudience: args.target_audience,
            });

            await sendProgress?.('Audio update started!', 4, 4);

            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Failed to update audio',
                };
            }

            return {
                success: true,
                status: result.status,
                notebook_id: notebookId,
                message: 'Audio regeneration started. Use get_audio_status to check progress.',
            };
        },

        /**
         * Handle delete_audio tool call
         */
        async handleDeleteAudio(
            args: { notebook_id?: string },
            sendProgress?: ProgressCallback
        ) {
            await sendProgress?.('Resolving notebook...', 1, 3);

            const notebookId = await resolveNotebookId(args.notebook_id);
            if (!notebookId) {
                return {
                    success: false,
                    error: 'No notebook specified. Use notebook_id parameter or select a notebook first.',
                };
            }

            await sendProgress?.('Deleting audio...', 2, 3);

            const result = await deleteAudio(notebookId);

            await sendProgress?.('Done!', 3, 3);

            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Failed to delete audio',
                };
            }

            return {
                success: true,
                status: result.status,
                notebook_id: notebookId,
                message: 'Audio overview deleted successfully.',
            };
        },

        /**
         * Handle download_audio tool call
         */
        async handleDownloadAudio(
            args: { notebook_id?: string },
            sendProgress?: ProgressCallback
        ) {
            await sendProgress?.('Resolving notebook...', 1, 4);

            const notebookId = await resolveNotebookId(args.notebook_id);
            if (!notebookId) {
                return {
                    success: false,
                    error: 'No notebook specified. Use notebook_id parameter or select a notebook first.',
                };
            }

            await sendProgress?.('Getting download URL...', 2, 4);

            const result = await getAudioDownloadURL(notebookId);

            await sendProgress?.('Done!', 4, 4);

            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Failed to get download URL',
                };
            }

            return {
                success: true,
                download_url: result.url,
                notebook_id: notebookId,
                message: 'Audio download URL retrieved. The URL may be temporary.',
            };
        },
    };
}

/**
 * Type for the studio handlers object
 */
export type StudioHandlers = ReturnType<typeof createStudioHandlers>;
