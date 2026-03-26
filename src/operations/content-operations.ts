/**
 * Content Generation Operations for NotebookLM
 *
 * Provides high-level operations for generating various types of content
 * from notebook sources using the NotebookLM API.
 *
 * All content generation uses the unified R7cb6c RPC (async trigger) followed
 * by polling gArtLc until the artifact is COMPLETED (status 3).
 */

import { getAPIClient, type NotebookLMAPIClient } from '../api/index.js';
import { initializeAPIClientWithCookies } from '../auth/cookie-store.js';
import { ContentTypeCode } from '../api/content-types.js';
import { log } from '../utils/logger.js';
import type { ContentType } from '../api/types.js';

/**
 * Result of a content generation operation
 */
export interface ContentGenerationResult {
  success: boolean;
  content?: string;
  contentType?: ContentType;
  error?: string;
  notebookId?: string;
  sourceIds?: string[];
  status?: string;
}

/**
 * Options for content generation
 */
export interface ContentGenerationOptions {
  /** Notebook ID to generate from */
  notebookId: string;
  /** Optional specific source IDs to use (defaults to all sources) */
  sourceIds?: string[];
  /** Optional custom prompt/instructions */
  customPrompt?: string;
}

/**
 * Get an initialized API client
 */
async function getInitializedClient(): Promise<NotebookLMAPIClient | null> {
  const client = getAPIClient();
  if (client.hasValidAuth()) return client;
  const success = await initializeAPIClientWithCookies(client);
  if (!success) return null;
  return client;
}

/**
 * Trigger content generation (fire-and-forget).
 * Returns immediately after triggering R7cb6c — does NOT wait for completion.
 * Use the NotebookLM UI or gArtLc polling to check results.
 */
async function generateContentByType(
  contentType: ContentTypeCode,
  contentTypeName: ContentType,
  options: ContentGenerationOptions,
): Promise<ContentGenerationResult> {
  const client = await getInitializedClient();
  if (!client) {
    return { success: false, error: 'API client not initialized. Please run setup_auth first.' };
  }

  try {
    log.info(`📝 Triggering ${contentTypeName} generation for ${options.notebookId}...`);

    // Just trigger — don't wait for completion
    const { buildContentGenerationRequest } = await import('../api/content-types.js');
    const request = buildContentGenerationRequest(options.notebookId, contentType, options.sourceIds);
    const response = await client.execute(request);

    if (!response.success) {
      return { success: false, error: response.error || `Failed to trigger ${contentTypeName}`, notebookId: options.notebookId };
    }

    return {
      success: true,
      status: 'generating',
      contentType: contentTypeName,
      notebookId: options.notebookId,
      sourceIds: options.sourceIds,
    };
  } catch (error) {
    return { success: false, error: `${contentTypeName} trigger failed: ${error}`, notebookId: options.notebookId };
  }
}

/**
 * Generate FAQ from notebook sources
 */
export async function generateFAQ(
  options: ContentGenerationOptions
): Promise<ContentGenerationResult> {
  return generateContentByType(ContentTypeCode.FAQ, 'faq', options);
}

/**
 * Generate Briefing Document from notebook sources
 */
export async function generateBriefing(
  options: ContentGenerationOptions
): Promise<ContentGenerationResult> {
  return generateContentByType(ContentTypeCode.BRIEFING, 'briefing', options);
}

/**
 * Generate Timeline from notebook sources
 */
export async function generateTimeline(
  options: ContentGenerationOptions
): Promise<ContentGenerationResult> {
  return generateContentByType(ContentTypeCode.TIMELINE, 'timeline', options);
}

/**
 * Generate Outline from notebook sources
 */
export async function generateOutline(
  options: ContentGenerationOptions
): Promise<ContentGenerationResult> {
  return generateContentByType(ContentTypeCode.OUTLINE, 'outline', options);
}

/**
 * Generate Study Guide from notebook sources
 */
export async function generateStudyGuide(
  options: ContentGenerationOptions
): Promise<ContentGenerationResult> {
  return generateContentByType(ContentTypeCode.STUDY_GUIDE, 'study_guide', options);
}

/**
 * Generate Flashcards from notebook sources
 */
export async function generateFlashcards(
  options: ContentGenerationOptions
): Promise<ContentGenerationResult> {
  return generateContentByType(ContentTypeCode.FLASHCARDS, 'flashcards', options);
}

/**
 * Generate Quiz from notebook sources
 */
export async function generateQuiz(
  options: ContentGenerationOptions
): Promise<ContentGenerationResult> {
  return generateContentByType(ContentTypeCode.QUIZ, 'quiz', options);
}

/**
 * Generate Mind Map from notebook sources
 */
export async function generateMindMap(
  options: ContentGenerationOptions
): Promise<ContentGenerationResult> {
  return generateContentByType(ContentTypeCode.OUTLINE, 'mindmap', options);
}

/**
 * Generate content of a specific type (generic dispatcher)
 */
export async function generateContent(
  contentType: ContentType,
  options: ContentGenerationOptions
): Promise<ContentGenerationResult> {
  switch (contentType) {
    case 'faq':
      return generateFAQ(options);
    case 'briefing':
      return generateBriefing(options);
    case 'timeline':
      return generateTimeline(options);
    case 'outline':
      return generateOutline(options);
    case 'study_guide':
      return generateStudyGuide(options);
    case 'flashcards':
      return generateFlashcards(options);
    case 'quiz':
      return generateQuiz(options);
    case 'mindmap':
      return generateMindMap(options);
    default:
      return {
        success: false,
        error: `Unsupported content type: ${contentType}`,
        notebookId: options.notebookId,
      };
  }
}

/**
 * Get suggested questions for a notebook
 */
export async function getSuggestedQuestions(
  notebookId: string
): Promise<{ success: boolean; questions: string[]; error?: string }> {
  const client = await getInitializedClient();
  if (!client) {
    return {
      success: false,
      questions: [],
      error: 'API client not initialized. Please run setup_auth first.',
    };
  }

  try {
    log.info(`📝 Getting suggested questions for notebook ${notebookId}...`);

    const questions = await client.getSuggestedQuestions(notebookId);

    return {
      success: true,
      questions,
    };
  } catch (error) {
    return {
      success: false,
      questions: [],
      error: `Failed to get suggested questions: ${error}`,
    };
  }
}
