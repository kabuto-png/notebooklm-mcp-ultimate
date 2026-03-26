/**
 * Request Builder for NotebookLM batchexecute API
 *
 * Builds properly formatted payloads for the Google batchexecute endpoint.
 * The format is a specific encoding that Google uses across many products.
 *
 * Payload format:
 * f.req = [[["rpcId","[args_json]",null,"requestId"]]]
 *
 * For multiple requests:
 * f.req = [[["rpc1","[args1]",null,"1"],["rpc2","[args2]",null,"2"]]]
 */

import type { RPCRequest } from './types.js';
import { getRPCName } from './rpc-ids.js';
import { log } from '../utils/logger.js';
import { buildContentGenerationRequest, ContentTypeCode } from './content-types.js';

/**
 * Build a single RPC request payload
 *
 * @param rpcId - The RPC method ID
 * @param args - Arguments for the RPC call
 * @param requestId - Optional request ID for tracking
 * @returns Formatted request array
 */
export function buildSingleRequest(
  rpcId: string,
  args: unknown[],
  requestId?: string
): unknown[] {
  // Convert args to JSON string
  const argsJson = JSON.stringify(args);

  // Request format: [rpcId, argsJson, null, requestId]
  return [rpcId, argsJson, null, requestId || 'generic'];
}

/**
 * Build a batch request payload containing multiple RPC calls
 *
 * @param requests - Array of RPC requests
 * @returns Formatted batch request for f.req parameter
 */
export function buildBatchPayload(requests: RPCRequest[]): string {
  const formattedRequests = requests.map((req, index) =>
    buildSingleRequest(req.rpcId, req.args, req.requestId || `req_${index}`)
  );

  // Wrap in outer array and stringify
  return JSON.stringify([formattedRequests]);
}

/**
 * Build URL-encoded form data for the request body
 *
 * @param requests - Array of RPC requests
 * @param atValue - The 'at' parameter (CSRF token or similar)
 * @returns URL-encoded form body string
 */
export function buildRequestBody(
  requests: RPCRequest[],
  atValue?: string
): string {
  const payload = buildBatchPayload(requests);

  const params = new URLSearchParams();
  params.append('f.req', payload);

  if (atValue) {
    params.append('at', atValue);
  }

  return params.toString();
}

/**
 * Build request headers for the batchexecute endpoint
 *
 * @param cookieHeader - Cookie header value
 * @param authHeader - Optional SAPISIDHASH authorization header
 * @returns Headers object
 */
export function buildRequestHeaders(
  cookieHeader: string,
  authHeader?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    Cookie: cookieHeader,
    Origin: 'https://notebooklm.google.com',
    Referer: 'https://notebooklm.google.com/',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'X-Same-Domain': '1',
  };

  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  return headers;
}

/**
 * Build the full URL for the batchexecute endpoint
 *
 * @param rpcIds - Array of RPC IDs being called (for query params)
 * @returns Full endpoint URL
 */
export function buildEndpointURL(rpcIds: string[]): string {
  const baseUrl = 'https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute';

  const params = new URLSearchParams();
  params.append('rpcids', rpcIds.join(','));
  params.append('source-path', '/');
  params.append('f.sid', '-' + Math.floor(Math.random() * 1e15).toString());
  params.append('bl', 'boq_labs-tailwind-frontend_20240101.00_p0'); // Version string
  params.append('hl', 'en');
  params.append('_reqid', Math.floor(Math.random() * 1e6).toString());
  params.append('rt', 'c');

  return `${baseUrl}?${params.toString()}`;
}

// ============================================================================
// Notebook-specific Request Builders
// ============================================================================

/**
 * Build request to list all notebooks
 */
export function buildListNotebooksRequest(): RPCRequest {
  return {
    rpcId: 'wXbhsf',
    args: [null, null, null, null, null, null, null, 20], // Limit 20
    requestId: 'list_notebooks',
  };
}

/**
 * Build request to get a specific notebook
 *
 * @param notebookId - The notebook ID
 */
export function buildGetNotebookRequest(notebookId: string): RPCRequest {
  return {
    rpcId: 'rLM1Ne',
    args: [notebookId, null, [2], null, 0],
    requestId: 'generic',
  };
}

/**
 * Build request to create a new notebook
 *
 * @param title - Optional title (defaults to "Untitled notebook")
 */
export function buildCreateNotebookRequest(title?: string): RPCRequest {
  return {
    rpcId: 'CCqFvf',
    args: [title || '', null, null, [2], [1, null, null, null, null, null, null, null, null, null, [1]]],
    requestId: 'generic',
  };
}

/**
 * Build request to delete a notebook
 *
 * @param notebookId - The notebook ID to delete
 */
export function buildDeleteNotebookRequest(notebookId: string): RPCRequest {
  return {
    rpcId: 'WWINqb',
    args: [[notebookId], [2]],
    requestId: 'generic',
  };
}

/**
 * Build request to rename a notebook
 *
 * @param notebookId - The notebook ID
 * @param newTitle - The new title
 */
export function buildRenameNotebookRequest(
  notebookId: string,
  newTitle: string
): RPCRequest {
  return {
    rpcId: 's0tc2d',
    args: [notebookId, [[null, null, null, [null, newTitle]]]],
    requestId: 'generic',
  };
}

// ============================================================================
// Source-specific Request Builders
// ============================================================================

/**
 * Build request to list sources in a notebook
 *
 * @param notebookId - The notebook ID
 */
export function buildListSourcesRequest(notebookId: string): RPCRequest {
  return {
    rpcId: 'hPTbtc',
    args: [[], null, notebookId, 20],
    requestId: 'generic',
  };
}

/**
 * Build request to add a URL source
 *
 * @param notebookId - The notebook ID
 * @param url - The URL to add
 */
export function buildAddURLSourceRequest(
  notebookId: string,
  url: string
): RPCRequest {
  return {
    rpcId: 'izAoDd',
    args: [[[null, null, [url], null, null, null, null, null, null, null, 1]], notebookId, [2], [1, null, null, null, null, null, null, null, null, null, [1]]],
    requestId: 'generic',
  };
}

/**
 * Build request to add a text source
 *
 * @param notebookId - The notebook ID
 * @param title - The source title
 * @param content - The text content
 */
export function buildAddTextSourceRequest(
  notebookId: string,
  title: string,
  content: string
): RPCRequest {
  return {
    rpcId: 'izAoDd',
    args: [[[null, [title, content], null, 2, null, null, null, null, null, null, 1]], notebookId, [2], [1, null, null, null, null, null, null, null, null, null, [1]]],
    requestId: 'generic',
  };
}

/**
 * Build request to add a YouTube source
 *
 * @param notebookId - The notebook ID
 * @param youtubeUrl - The YouTube video URL
 */
export function buildAddYouTubeSourceRequest(
  notebookId: string,
  youtubeUrl: string
): RPCRequest {
  return {
    rpcId: 'n8xVHd',
    args: [notebookId, youtubeUrl],
    requestId: 'add_youtube_source',
  };
}

/**
 * Build request to add a Google Drive source
 *
 * @param notebookId - The notebook ID
 * @param fileId - The Google Drive file ID
 */
export function buildAddDriveSourceRequest(
  notebookId: string,
  fileId: string
): RPCRequest {
  return {
    rpcId: 'Y7Ryrc',
    args: [notebookId, [fileId]],
    requestId: 'add_drive_source',
  };
}

/**
 * Build request to delete a source
 *
 * @param notebookId - The notebook ID
 * @param sourceId - The source ID to delete
 */
export function buildDeleteSourceRequest(
  _notebookId: string,
  sourceId: string
): RPCRequest {
  return {
    rpcId: 'tGMBJ',
    args: [[[sourceId]], [2]],
    requestId: 'generic',
  };
}

/**
 * Build request to get source details
 *
 * @param notebookId - The notebook ID
 * @param sourceId - The source ID
 */
export function buildGetSourceRequest(
  _notebookId: string,
  sourceId: string
): RPCRequest {
  return {
    rpcId: 'hizoJc',
    args: [[sourceId], [2], [2]],
    requestId: 'generic',
  };
}

// ============================================================================
// Audio Studio Request Builders
// ============================================================================

/**
 * Build request to get audio overview status
 *
 * @param notebookId - The notebook ID
 */
export function buildGetAudioStatusRequest(notebookId: string): RPCRequest {
  return {
    rpcId: 'R7cb6c',
    args: [[2, null, null, [1, null, null, null, null, null, null, null, null, null, [1]], [[2, 1, 3]]], notebookId, [null, null, 1, null, null, null, null, null, null, null, null, null, 1]],
    requestId: 'generic',
  };
}

/**
 * Build request to create/generate audio overview
 *
 * @param notebookId - The notebook ID
 * @param _customInstructions - Optional custom instructions (not yet supported by API)
 */
export function buildCreateAudioRequest(
  notebookId: string,
  _customInstructions?: string
): RPCRequest {
  return buildContentGenerationRequest(notebookId, ContentTypeCode.AUDIO_OVERVIEW);
}

/**
 * Build request to delete audio overview
 *
 * @param notebookId - The notebook ID
 */
export function buildDeleteAudioRequest(notebookId: string): RPCRequest {
  return {
    rpcId: 'pzGYuc',
    args: [notebookId],
    requestId: 'delete_audio',
  };
}

/**
 * Build request to get audio download URL
 *
 * @param notebookId - The notebook ID
 */
export function buildGetAudioURLRequest(notebookId: string): RPCRequest {
  return {
    rpcId: 'NkDhJc',
    args: [notebookId],
    requestId: 'get_audio_url',
  };
}

// ============================================================================
// Content Generation Request Builders
// ============================================================================

/**
 * Build request to generate FAQ
 *
 * @param notebookId - The notebook ID
 * @param sourceIds - Optional specific source IDs (defaults to all)
 */
export function buildGenerateFAQRequest(
  notebookId: string,
  sourceIds?: string[]
): RPCRequest {
  return buildContentGenerationRequest(notebookId, ContentTypeCode.FAQ, sourceIds);
}

/**
 * Build request to generate briefing document
 *
 * @param notebookId - The notebook ID
 * @param sourceIds - Optional specific source IDs
 */
export function buildGenerateBriefingRequest(
  notebookId: string,
  sourceIds?: string[]
): RPCRequest {
  return buildContentGenerationRequest(notebookId, ContentTypeCode.BRIEFING, sourceIds);
}

/**
 * Build request to generate timeline
 *
 * @param notebookId - The notebook ID
 * @param sourceIds - Optional specific source IDs
 */
export function buildGenerateTimelineRequest(
  notebookId: string,
  sourceIds?: string[]
): RPCRequest {
  return buildContentGenerationRequest(notebookId, ContentTypeCode.TIMELINE, sourceIds);
}

/**
 * Build request to generate study guide
 *
 * @param notebookId - The notebook ID
 * @param sourceIds - Optional specific source IDs
 */
export function buildGenerateStudyGuideRequest(
  notebookId: string,
  sourceIds?: string[]
): RPCRequest {
  return buildContentGenerationRequest(notebookId, ContentTypeCode.STUDY_GUIDE, sourceIds);
}

// ============================================================================
// Q&A Request Builders
// ============================================================================

/**
 * Build request to get suggested questions
 *
 * @param notebookId - The notebook ID
 */
export function buildGetSuggestionsRequest(notebookId: string): RPCRequest {
  return {
    rpcId: 'JT0DSd',
    args: [notebookId],
    requestId: 'get_suggestions',
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Log request details for debugging
 *
 * @param requests - The requests being sent
 */
export function logRequests(requests: RPCRequest[]): void {
  log.dim(`📤 Sending ${requests.length} RPC request(s):`);
  for (const req of requests) {
    log.dim(`   - ${getRPCName(req.rpcId)} (${req.rpcId})`);
  }
}
