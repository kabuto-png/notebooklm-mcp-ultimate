/**
 * Content Generation Tool Handlers
 *
 * Implements the handler logic for content generation tools.
 */

import type { NotebookLibrary } from '../../library/notebook-library.js';
import type { ProgressCallback } from '../../types.js';
import {
  generateFAQ,
  generateBriefing,
  generateTimeline,
  generateOutline,
  generateStudyGuide,
  generateFlashcards,
  generateQuiz,
  generateMindMap,
  getSuggestedQuestions,
} from '../../operations/content-operations.js';
import { log } from '../../utils/logger.js';

/**
 * Content handler dependencies
 */
export interface ContentHandlerDependencies {
  library: NotebookLibrary;
}

/**
 * Create content handlers with dependencies
 */
export function createContentHandlers(deps: ContentHandlerDependencies) {
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

  /**
   * Format content result for MCP response
   */
  function formatContentResult(result: {
    success: boolean;
    content?: string;
    contentType?: string;
    error?: string;
    notebookId?: string;
    status?: string;
  }) {
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Content generation failed',
      };
    }

    // Timed out but generation was triggered successfully
    if (result.status === 'generating') {
      return {
        success: true,
        status: 'generating',
        message: 'Content generation started. Check back in a few minutes.',
        content_type: result.contentType,
        notebook_id: result.notebookId,
      };
    }

    return {
      success: true,
      content_type: result.contentType,
      content: result.content,
      notebook_id: result.notebookId,
    };
  }

  return {
    /**
     * Handle generate_faq tool call
     */
    async handleGenerateFAQ(
      args: { notebook_id?: string; source_ids?: string[] },
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

      await sendProgress?.('Generating FAQ...', 2, 4);

      const result = await generateFAQ({
        notebookId,
        sourceIds: args.source_ids,
      });

      await sendProgress?.('FAQ generated!', 4, 4);

      return formatContentResult(result);
    },

    /**
     * Handle generate_briefing tool call
     */
    async handleGenerateBriefing(
      args: { notebook_id?: string; source_ids?: string[] },
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

      await sendProgress?.('Generating briefing...', 2, 4);

      const result = await generateBriefing({
        notebookId,
        sourceIds: args.source_ids,
      });

      await sendProgress?.('Briefing generated!', 4, 4);

      return formatContentResult(result);
    },

    /**
     * Handle generate_timeline tool call
     */
    async handleGenerateTimeline(
      args: { notebook_id?: string; source_ids?: string[] },
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

      await sendProgress?.('Generating timeline...', 2, 4);

      const result = await generateTimeline({
        notebookId,
        sourceIds: args.source_ids,
      });

      await sendProgress?.('Timeline generated!', 4, 4);

      return formatContentResult(result);
    },

    /**
     * Handle generate_outline tool call
     */
    async handleGenerateOutline(
      args: { notebook_id?: string; source_ids?: string[] },
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

      await sendProgress?.('Generating outline...', 2, 4);

      const result = await generateOutline({
        notebookId,
        sourceIds: args.source_ids,
      });

      await sendProgress?.('Outline generated!', 4, 4);

      return formatContentResult(result);
    },

    /**
     * Handle generate_study_guide tool call
     */
    async handleGenerateStudyGuide(
      args: { notebook_id?: string; source_ids?: string[] },
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

      await sendProgress?.('Generating study guide...', 2, 4);

      const result = await generateStudyGuide({
        notebookId,
        sourceIds: args.source_ids,
      });

      await sendProgress?.('Study guide generated!', 4, 4);

      return formatContentResult(result);
    },

    /**
     * Handle generate_flashcards tool call
     */
    async handleGenerateFlashcards(
      args: { notebook_id?: string; source_ids?: string[] },
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

      await sendProgress?.('Generating flashcards...', 2, 4);

      const result = await generateFlashcards({
        notebookId,
        sourceIds: args.source_ids,
      });

      await sendProgress?.('Flashcards generated!', 4, 4);

      return formatContentResult(result);
    },

    /**
     * Handle generate_quiz tool call
     */
    async handleGenerateQuiz(
      args: { notebook_id?: string; source_ids?: string[] },
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

      await sendProgress?.('Generating quiz...', 2, 4);

      const result = await generateQuiz({
        notebookId,
        sourceIds: args.source_ids,
      });

      await sendProgress?.('Quiz generated!', 4, 4);

      return formatContentResult(result);
    },

    /**
     * Handle generate_mindmap tool call
     */
    async handleGenerateMindMap(
      args: { notebook_id?: string; source_ids?: string[] },
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

      await sendProgress?.('Generating mind map...', 2, 4);

      const result = await generateMindMap({
        notebookId,
        sourceIds: args.source_ids,
      });

      await sendProgress?.('Mind map generated!', 4, 4);

      return formatContentResult(result);
    },

    /**
     * Handle suggest_questions tool call
     */
    async handleSuggestQuestions(
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

      await sendProgress?.('Getting suggestions...', 2, 3);

      const result = await getSuggestedQuestions(notebookId);

      await sendProgress?.('Done!', 3, 3);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get suggestions',
        };
      }

      return {
        success: true,
        questions: result.questions,
        notebook_id: notebookId,
      };
    },
  };
}

/**
 * Type for the content handlers object
 */
export type ContentHandlers = ReturnType<typeof createContentHandlers>;
