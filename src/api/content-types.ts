/**
 * Content Type Mapping for NotebookLM Unified Content Generation RPC
 *
 * All content generation uses the unified RPC ID `R7cb6c` with a type code
 * to specify which kind of content to generate.
 */

import type { RPCRequest } from './types.js';

// ============================================================================
// Content Type Enum
// ============================================================================

/**
 * Numeric type codes for R7cb6c unified content generation RPC.
 * These values are passed as the third element of the third argument array.
 */
export const ContentTypeCode = {
  AUDIO_OVERVIEW: 1,
  STUDY_GUIDE: 2,
  BRIEFING: 3,
  FLASHCARDS: 4,
  QUIZ: 5,
  FAQ: 6,
  TIMELINE: 7,
  OUTLINE: 8,
  INFOGRAPHIC: 9,
  DATA_TABLE: 10,
} as const;

export type ContentTypeCode = typeof ContentTypeCode[keyof typeof ContentTypeCode];

/** Human-readable labels for each content type code */
export const CONTENT_TYPE_LABELS: Record<ContentTypeCode, string> = {
  [ContentTypeCode.AUDIO_OVERVIEW]: 'Audio Overview',
  [ContentTypeCode.STUDY_GUIDE]: 'Study Guide',
  [ContentTypeCode.BRIEFING]: 'Briefing / Report',
  [ContentTypeCode.FLASHCARDS]: 'Flashcards',
  [ContentTypeCode.QUIZ]: 'Quiz',
  [ContentTypeCode.FAQ]: 'FAQ',
  [ContentTypeCode.TIMELINE]: 'Timeline',
  [ContentTypeCode.OUTLINE]: 'Outline / Mind Map',
  [ContentTypeCode.INFOGRAPHIC]: 'Infographic',
  [ContentTypeCode.DATA_TABLE]: 'Data Table',
};

// ============================================================================
// Request Builder
// ============================================================================

/**
 * Standard first-argument payload used by all R7cb6c list-artifact calls.
 * This queries for existing artifacts of all statuses.
 */
const LIST_ARTIFACTS_FIRST_ARG = [
  2, null, null,
  [1, null, null, null, null, null, null, null, null, null, [1]],
  [[2, 1, 3]],
];

/**
 * Build a R7cb6c content generation request for any content type.
 *
 * @param notebookId - Target notebook ID
 * @param typeCode - Content type code from ContentTypeCode
 * @param sourceIds - Optional source IDs to restrict generation
 * @returns Formatted RPCRequest ready for batchexecute
 */
export function buildContentGenerationRequest(
  notebookId: string,
  typeCode: ContentTypeCode,
  sourceIds?: string[],
): RPCRequest {
  const srcFilter = sourceIds ? [sourceIds.map((id) => [id])] : null;
  return {
    rpcId: 'R7cb6c',
    args: [
      LIST_ARTIFACTS_FIRST_ARG,
      notebookId,
      [null, null, typeCode, srcFilter, null, null, null, null, null, null, null, null, 1],
    ],
    requestId: 'generic',
  };
}

/**
 * Build a R7cb6c list-artifacts request (used by the operation poller).
 *
 * @param notebookId - Target notebook ID
 * @param filterExpression - Optional filter expression (e.g. status filter)
 * @returns Formatted RPCRequest
 */
export function buildListArtifactsRequest(
  notebookId: string,
  filterExpression?: string,
): RPCRequest {
  return {
    rpcId: 'gArtLc',
    args: [
      LIST_ARTIFACTS_FIRST_ARG,
      notebookId,
      filterExpression ?? 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"',
    ],
    requestId: 'generic',
  };
}
