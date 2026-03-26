/**
 * Response Parser for NotebookLM batchexecute API
 * PARSER VERSION: v3-fixed-unwrap (2026-03-21 15:05)
 *
 * Parses the specific response format used by Google's batchexecute endpoint.
 * The format is a custom streaming protocol with multiple lines of JSON.
 *
 * Response format:
 * )]}'\n
 * [length]\n
 * [[json_array]]\n
 * [length]\n
 * [[json_array]]\n
 * ...
 *
 * Each JSON array contains response data for one or more RPC calls.
 */


import type {
  BatchExecuteResponse,
  RPCResponse,
  APINotebook,
  APISource,
  APIAudioOverview,
  SourceType,
} from './types.js';
import { log } from '../utils/logger.js';

/**
 * Parse a batchexecute response
 *
 * @param responseText - Raw response text from the API
 * @returns Parsed response with individual RPC results
 */
export function parseBatchExecuteResponse(
  responseText: string
): BatchExecuteResponse {
  const responses = new Map<string, RPCResponse>();

  try {
    // Remove the security prefix )]}' if present
    let cleaned = responseText;
    if (cleaned.startsWith(")]}'")) {
      cleaned = cleaned.slice(4);
    }
    cleaned = cleaned.trim();

    // Split into lines and try to parse each as JSON
    // The format is: length\nJSON\nlength\nJSON\n...
    // But length indicators can be unreliable after split, so we
    // simply try to parse every non-numeric line as JSON.
    const lines = cleaned.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip pure numeric lines (length indicators)
      if (/^\d+$/.test(trimmed)) continue;

      // Try to parse as JSON
      try {
        const parsed = JSON.parse(trimmed);
        processResponseChunk(parsed, responses);
      } catch {
        // Not valid JSON, skip
      }
    }



    return {
      success: responses.size > 0,
      responses,
      rawResponse: responseText,
    };
  } catch (error) {
    return {
      success: false,
      responses,
      rawResponse: responseText,
      error: `Parse error: ${error}`,
    };
  }
}

/**
 * Process a single response chunk
 *
 * @param data - Parsed JSON data
 * @param responses - Map to store responses
 */
function processResponseChunk(
  data: unknown,
  responses: Map<string, RPCResponse>
): void {
  if (!Array.isArray(data)) {
    return;
  }

  // Response format varies:
  // Single-wrapped: [["wrb.fr","rpcId","[data]",...], ["di",N], ...]
  // Double-wrapped: [[["wrb.fr","rpcId","[data]",...], ["di",N], ...]]
  // Detect by checking if data[0][0] is a string (single) or array (double)
  const firstElement = data[0];
  const items = Array.isArray(firstElement) && typeof firstElement[0] === 'string'
    ? data  // single-wrapped: data itself contains the items
    : (Array.isArray(firstElement) ? firstElement : data);  // double-wrapped: unwrap one level

  for (const item of items) {
    if (!Array.isArray(item)) {
      continue;
    }

    // Check for the "wrb.fr" marker which indicates a response
    if (item[0] === 'wrb.fr') {
      const rpcId = item[1];
      const responseJson = item[2];

      if (typeof rpcId === 'string') {
        try {
          const responseData = typeof responseJson === 'string'
            ? JSON.parse(responseJson)
            : responseJson;

          responses.set(rpcId, {
            success: true,
            data: responseData,
            rawData: item,
          });
        } catch {
          responses.set(rpcId, {
            success: true,
            data: responseJson,
            rawData: item,
          });
        }
      }
    }

    // Check for error responses
    if (item[0] === 'er') {
      const rpcId = item[1];
      const errorInfo = item[2];

      if (typeof rpcId === 'string') {
        responses.set(rpcId, {
          success: false,
          error: `RPC error: ${JSON.stringify(errorInfo)}`,
          rawData: item,
        });
      }
    }

    // Check for di.dr (another response format)
    if (item[0] === 'di' && Array.isArray(item[1])) {
      // Direct response data
    }
  }
}

/**
 * Extract a specific response from a BatchExecuteResponse
 *
 * @param response - The batch response
 * @param rpcId - The RPC ID to extract
 * @returns The specific RPC response or undefined
 */
export function extractResponse(
  response: BatchExecuteResponse,
  rpcId: string
): RPCResponse | undefined {
  return response.responses.get(rpcId);
}

/**
 * Get first successful response from a BatchExecuteResponse
 *
 * @param response - The batch response
 * @returns First successful response or undefined
 */
export function getFirstSuccessfulResponse(
  response: BatchExecuteResponse
): RPCResponse | undefined {
  for (const [, rpcResponse] of response.responses) {
    if (rpcResponse.success) {
      return rpcResponse;
    }
  }
  return undefined;
}

// ============================================================================
// Notebook Parsing
// ============================================================================

/**
 * Parse notebook list response
 *
 * @param data - Raw response data
 * @returns Array of notebooks
 */
export function parseNotebookList(data: unknown): APINotebook[] {
  const notebooks: APINotebook[] = [];

  if (!Array.isArray(data)) {
    return notebooks;
  }

  // Notebook list is typically in the first array element
  const notebookArray = data[0];

  if (!Array.isArray(notebookArray)) {
    return notebooks;
  }

  for (const item of notebookArray) {
    if (!Array.isArray(item)) {
      continue;
    }

    const notebook = parseNotebookItem(item);
    if (notebook) {
      notebooks.push(notebook);
    }
  }

  return notebooks;
}

/**
 * Parse a single notebook item from the response
 *
 * @param item - Raw notebook data array
 * @returns Parsed notebook or null
 */
export function parseNotebookItem(item: unknown[]): APINotebook | null {
  try {
    // Typical structure: [id, title, null, null, timestamp_created, timestamp_modified, ...]
    const id = item[0];
    const title = item[1] || 'Untitled notebook';

    if (typeof id !== 'string') {
      return null;
    }

    const notebook: APINotebook = {
      id,
      title: String(title),
    };

    // Try to extract timestamps (positions may vary)
    // They're typically in microseconds
    if (typeof item[4] === 'number') {
      notebook.createdAt = item[4];
    }
    if (typeof item[5] === 'number') {
      notebook.modifiedAt = item[5];
    }

    // Try to find source count
    for (let i = 6; i < item.length; i++) {
      const element = item[i];
      if (Array.isArray(element) && typeof element[0] === 'number') {
        notebook.sourceCount = element[0];
        break;
      }
    }

    return notebook;
  } catch {
    return null;
  }
}

/**
 * Parse notebook creation response
 *
 * @param data - Raw response data
 * @returns Created notebook ID or null
 */
export function parseCreateNotebookResponse(data: unknown): string | null {
  if (!Array.isArray(data)) {
    return null;
  }

  // Notebook ID is at index 2 (index 0 is title, which can be empty string)
  if (typeof data[2] === 'string' && data[2].length > 0) {
    return data[2];
  }

  // Fallback: check index 0 if non-empty
  if (typeof data[0] === 'string' && data[0].length > 0) {
    return data[0];
  }

  // Fallback: nested array
  if (Array.isArray(data[0]) && typeof data[0][0] === 'string') {
    return data[0][0];
  }

  return null;
}

// ============================================================================
// Source Parsing
// ============================================================================

/**
 * Parse source list response
 *
 * @param data - Raw response data
 * @returns Array of sources
 */
export function parseSourceList(data: unknown): APISource[] {
  const sources: APISource[] = [];

  if (!Array.isArray(data)) {
    return sources;
  }

  // Sources are typically in the first array
  const sourceArray = data[0];

  if (!Array.isArray(sourceArray)) {
    return sources;
  }

  for (const item of sourceArray) {
    if (!Array.isArray(item)) {
      continue;
    }

    const source = parseSourceItem(item);
    if (source) {
      sources.push(source);
    }
  }

  return sources;
}

/**
 * Parse a single source item
 *
 * @param item - Raw source data array
 * @returns Parsed source or null
 */
export function parseSourceItem(item: unknown[]): APISource | null {
  try {
    const id = item[0];
    const title = item[1] || item[2] || 'Untitled source';

    if (typeof id !== 'string') {
      return null;
    }

    // Determine source type from various indicators
    let type: SourceType = 'text';
    let url: string | undefined;

    // Check for URL-like content
    for (const field of item) {
      if (typeof field === 'string') {
        if (field.startsWith('http://') || field.startsWith('https://')) {
          url = field;
          if (field.includes('youtube.com') || field.includes('youtu.be')) {
            type = 'youtube';
          } else if (field.includes('drive.google.com')) {
            type = 'drive';
          } else {
            type = 'url';
          }
          break;
        }
      }
    }

    // Check for type indicators — use the FIRST numeric field after index 1 (the ID/title
    // positions) and stop after the first match to avoid later numbers overwriting the type.
    for (let i = 2; i < item.length; i++) {
      const field = item[i];
      if (typeof field === 'number' && field >= 1 && field <= 5) {
        switch (field) {
          case 1: type = 'pdf'; break;
          case 2: type = 'url'; break;
          case 3: type = 'youtube'; break;
          case 4: type = 'drive'; break;
          case 5: type = 'text'; break;
        }
        break; // Use first match only — later numbers are not type codes
      }
    }

    // Determine status
    let status: 'processing' | 'ready' | 'error' = 'ready';

    // Check for status indicators (typically numeric codes)
    for (const field of item) {
      if (Array.isArray(field) && field.length > 0) {
        const statusCode = field[0];
        if (statusCode === 0 || statusCode === 1) {
          status = 'processing';
        } else if (statusCode === 2) {
          status = 'ready';
        } else if (statusCode === 3 || statusCode === -1) {
          status = 'error';
        }
      }
    }

    const source: APISource = {
      id,
      title: String(title),
      type,
      url,
      status,
    };

    return source;
  } catch {
    return null;
  }
}

// ============================================================================
// Audio Parsing
// ============================================================================

/**
 * Parse audio status response
 *
 * @param data - Raw response data
 * @returns Audio overview status
 */
export function parseAudioStatus(data: unknown): APIAudioOverview {
  const result: APIAudioOverview = {
    status: 'not_created',
  };

  if (!Array.isArray(data)) {
    return result;
  }

  try {
    // Check for audio ID
    if (typeof data[0] === 'string' && data[0].length > 0) {
      result.id = data[0];
      result.status = 'ready';
    }

    // Check for status code
    for (const field of data) {
      if (typeof field === 'number') {
        switch (field) {
          case 0:
            result.status = 'not_created';
            break;
          case 1:
            result.status = 'generating';
            break;
          case 2:
            result.status = 'ready';
            break;
          case 3:
            result.status = 'error';
            break;
        }
      }
    }

    // Check for audio URL
    for (const field of data) {
      if (typeof field === 'string' && field.includes('googleusercontent.com')) {
        result.audioUrl = field;
        result.status = 'ready';
      }
    }

    // Check for progress
    for (const field of data) {
      if (Array.isArray(field) && typeof field[0] === 'number') {
        result.progress = field[0];
      }
    }

    // Check for duration
    for (const field of data) {
      if (typeof field === 'number' && field > 60 && field < 3600) {
        // Likely duration in seconds
        result.durationSeconds = field;
      }
    }

    return result;
  } catch {
    return result;
  }
}

/**
 * Parse audio download URL response
 *
 * @param data - Raw response data
 * @returns Audio URL or null
 */
export function parseAudioURL(data: unknown): string | null {
  if (!Array.isArray(data)) {
    return null;
  }

  // Search for URL in the response
  const findUrl = (arr: unknown[]): string | null => {
    for (const item of arr) {
      if (typeof item === 'string' && item.includes('googleusercontent.com')) {
        return item;
      }
      if (Array.isArray(item)) {
        const found = findUrl(item);
        if (found) return found;
      }
    }
    return null;
  };

  return findUrl(data);
}

// ============================================================================
// Content Generation Parsing
// ============================================================================

/**
 * Parse generated content response
 *
 * @param data - Raw response data
 * @returns Generated content string or null
 */
export function parseGeneratedContent(data: unknown): string | null {
  if (!Array.isArray(data)) {
    return null;
  }

  // Content is typically a long string in the response.
  // Skip URLs and JSON-like strings that could be false positives.
  const findContent = (arr: unknown[]): string | null => {
    for (const item of arr) {
      if (typeof item === 'string' && item.length > 100) {
        // Skip URLs and serialized JSON — not generated content
        if (
          item.startsWith('http://') ||
          item.startsWith('https://') ||
          item.startsWith('{') ||
          item.startsWith('[')
        ) {
          continue;
        }
        return item;
      }
      if (Array.isArray(item)) {
        const found = findContent(item);
        if (found) return found;
      }
    }
    return null;
  };

  return findContent(data);
}

// ============================================================================
// Q&A Parsing
// ============================================================================

/**
 * Parse suggested questions response
 *
 * @param data - Raw response data
 * @returns Array of suggested questions
 */
export function parseSuggestedQuestions(data: unknown): string[] {
  const questions: string[] = [];

  if (!Array.isArray(data)) {
    return questions;
  }

  const findQuestions = (arr: unknown[]): void => {
    for (const item of arr) {
      if (typeof item === 'string' && item.endsWith('?') && item.length > 10) {
        questions.push(item);
      }
      if (Array.isArray(item)) {
        findQuestions(item);
      }
    }
  };

  findQuestions(data);
  return questions;
}

// ============================================================================
// Error Parsing
// ============================================================================

/**
 * Check if response indicates an authentication error
 *
 * @param response - The batch response
 * @returns True if auth error detected
 */
export function isAuthError(response: BatchExecuteResponse): boolean {
  // Check raw response for auth-related errors using specific phrases only,
  // not bare numeric codes like "401" which can appear in IDs or timestamps.
  if (response.rawResponse) {
    const raw = response.rawResponse.toLowerCase();
    if (
      raw.includes('unauthorized') ||
      raw.includes('login required') ||
      raw.includes('not authenticated')
    ) {
      return true;
    }
  }

  // Check individual responses for errors
  for (const [, rpcResponse] of response.responses) {
    if (rpcResponse.error) {
      const error = rpcResponse.error.toLowerCase();
      if (
        error.includes('auth') ||
        error.includes('login') ||
        error.includes('permission')
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if response indicates a rate limit error
 *
 * @param response - The batch response
 * @returns True if rate limited
 */
export function isRateLimited(response: BatchExecuteResponse): boolean {
  // Use specific phrases only — not bare "429" which can match IDs or timestamps.
  if (response.rawResponse) {
    const raw = response.rawResponse.toLowerCase();
    if (
      raw.includes('rate limit') ||
      raw.includes('too many requests') ||
      raw.includes('quota exceeded')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Log response for debugging
 *
 * @param response - The batch response
 */
export function logResponse(response: BatchExecuteResponse): void {
  log.dim(`📥 Received response (success: ${response.success})`);
  log.dim(`   Responses: ${response.responses.size}`);

  for (const [rpcId, rpcResponse] of response.responses) {
    const status = rpcResponse.success ? '✓' : '✗';
    log.dim(`   ${status} ${rpcId}`);
    if (rpcResponse.error) {
      log.dim(`     Error: ${rpcResponse.error}`);
    }
  }
}
