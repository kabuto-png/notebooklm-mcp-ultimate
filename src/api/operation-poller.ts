/**
 * Async Operation Poller for NotebookLM Content Generation
 *
 * Content generation via R7cb6c returns immediately while the actual work
 * happens asynchronously. This module polls the gArtLc (list artifacts) RPC
 * until the content is ready (status code 3 = completed) or a timeout occurs.
 */

import type { BatchExecuteResponse } from './types.js';
import { buildListArtifactsRequest, ContentTypeCode, CONTENT_TYPE_LABELS } from './content-types.js';
import { buildContentGenerationRequest } from './content-types.js';
import { log } from '../utils/logger.js';

/** Artifact status codes returned by gArtLc */
export const ArtifactStatus = {
  UNKNOWN: 0,
  PENDING: 1,
  PROCESSING: 2,
  COMPLETED: 3,
  ERROR: 4,
} as const;

/** A single artifact entry from gArtLc response */
export interface Artifact {
  id: string;
  title: string;
  type: number;
  status: number;
  sourceIds?: string[];
  content?: string;
  createdAt?: number;  // Unix timestamp (ms) when artifact was created
}

/** Result from generateAndWait */
export interface GenerateAndWaitResult {
  success: boolean;
  content?: string;
  artifact?: Artifact;
  error?: string;
  timedOut?: boolean;
}

/** Minimal client interface needed by the poller */
export interface PollerClient {
  executeBatch(requests: ReturnType<typeof buildListArtifactsRequest>[]): Promise<BatchExecuteResponse>;
  execute(request: ReturnType<typeof buildListArtifactsRequest>): Promise<BatchExecuteResponse>;
}

/**
 * Parse artifact list from gArtLc response data
 */
function parseArtifacts(data: unknown): Artifact[] {
  const results: Artifact[] = [];
  if (!Array.isArray(data)) return results;

  const walk = (arr: unknown[]): void => {
    for (const item of arr) {
      if (
        Array.isArray(item)
        && item.length >= 5           // Artifacts have at least 5 fields
        && typeof item[0] === 'string'
        && item[0].length > 0         // Non-empty ID
        && typeof item[2] === 'number'
        && item[2] >= 1 && item[2] <= 10  // Valid content type range
      ) {
        results.push({
          id: item[0] as string,
          title: typeof item[1] === 'string' ? item[1] : '',
          type: item[2] as number,
          status: typeof item[4] === 'number' ? item[4] : 0,
          sourceIds: Array.isArray(item[3]) ? (item[3] as unknown[]).map(String) : undefined,
          content: typeof item[5] === 'string' ? item[5] : undefined,
          // Try to extract creation timestamp from item[6] or item[7]
          createdAt: typeof item[6] === 'number' ? item[6] :
                     typeof item[7] === 'number' ? item[7] : undefined,
        });
      } else if (Array.isArray(item)) {
        walk(item);
      }
    }
  };

  walk(data);
  return results;
}

/**
 * Poll for a completed artifact of the given type in a notebook.
 *
 * @param client - BatchExecuteClient-compatible instance
 * @param notebookId - Target notebook ID
 * @param artifactType - ContentTypeCode to look for
 * @param maxWaitMs - Maximum time to wait (default: 120_000)
 * @param intervalMs - Polling interval (default: 5_000)
 * @param createdAfter - Only match artifacts created after this timestamp (ms)
 * @param signal - Optional AbortSignal to cancel polling
 * @returns The first matching completed artifact, or null on timeout/error/cancellation
 */
export async function pollOperation(
  client: PollerClient,
  notebookId: string,
  artifactType: ContentTypeCode,
  maxWaitMs = 120_000,
  intervalMs = 5_000,
  createdAfter?: number,
  signal?: AbortSignal,
): Promise<Artifact | null> {
  const deadline = Date.now() + maxWaitMs;
  const label = CONTENT_TYPE_LABELS[artifactType];

  log.dim(`⏳ Polling for ${label} artifact in notebook ${notebookId}...`);

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      log.warning('⚠️  Polling cancelled');
      return null;
    }

    const request = buildListArtifactsRequest(notebookId);
    const response = await client.execute(request);

    if (response.success) {
      for (const [, rpc] of response.responses) {
        if (rpc.success && rpc.data) {
          const artifacts = parseArtifacts(rpc.data);
          const match = artifacts.find(
            (a) =>
              a.type === artifactType
              && a.status === ArtifactStatus.COMPLETED
              && (createdAfter === undefined || a.createdAt === undefined || a.createdAt >= createdAfter),
          );
          if (match) {
            log.dim(`✓ ${label} artifact ready: ${match.id}`);
            return match;
          }
        }
      }
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
  }

  log.warning(`⚠️  Timeout waiting for ${label} artifact after ${maxWaitMs}ms`);
  return null;
}

/**
 * Generate content and wait for it to be ready.
 *
 * Triggers generation via R7cb6c then polls gArtLc until complete.
 *
 * @param client - NotebookLMAPIClient-compatible instance
 * @param notebookId - Target notebook ID
 * @param contentType - Content type to generate
 * @param sourceIds - Optional source ID filter
 * @param maxWaitMs - Maximum polling duration (default: 120_000)
 * @returns Result with content string when successful
 */
export async function generateAndWait(
  client: PollerClient,
  notebookId: string,
  contentType: ContentTypeCode,
  sourceIds?: string[],
  maxWaitMs = 120_000,
): Promise<GenerateAndWaitResult> {
  // Record time BEFORE triggering generation to avoid returning stale artifacts
  const triggeredAt = Date.now();

  // Trigger generation
  const genRequest = buildContentGenerationRequest(notebookId, contentType, sourceIds);
  const genResponse = await client.execute(genRequest);

  if (!genResponse.success) {
    return { success: false, error: genResponse.error || 'Failed to trigger generation' };
  }

  // Poll until ready, only matching artifacts created after we triggered
  const artifact = await pollOperation(client, notebookId, contentType, maxWaitMs, 5_000, triggeredAt);
  if (!artifact) {
    return { success: false, timedOut: true, error: `Timed out after ${maxWaitMs}ms` };
  }

  return {
    success: true,
    artifact,
    content: artifact.content,
  };
}
