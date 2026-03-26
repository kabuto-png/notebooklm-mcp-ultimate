/**
 * BatchExecute Client for NotebookLM Internal API
 *
 * Main client for making API calls to the NotebookLM batchexecute endpoint.
 * This is the primary interface for API operations.
 *
 * Features:
 * - Cookie-based authentication
 * - CSRF token handling
 * - Automatic retries with exponential backoff
 * - Request/response logging
 * - Error classification
 */

import type { RPCRequest, Cookie, BatchExecuteResponse } from './types.js';
import { csrfManager } from './csrf-manager.js';
import {
  buildRequestBody,
  buildRequestHeaders,
  buildEndpointURL,
  logRequests,
} from './request-builder.js';
import {
  parseBatchExecuteResponse,
  isAuthError,
  isRateLimited,
  logResponse,
} from './response-parser.js';
import { log } from '../utils/logger.js';

/**
 * Configuration options for the API client
 */
export interface BatchExecuteClientConfig {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  retryBaseDelay?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * BatchExecute API Client
 *
 * Provides high-level methods for interacting with the NotebookLM API.
 */
export class BatchExecuteClient {
  private config: Required<BatchExecuteClientConfig>;
  private cookies: Cookie[] = [];
  private lastRequestTime = 0;

  /** Minimum delay between requests to avoid rate limiting (ms) */
  private readonly MIN_REQUEST_INTERVAL = 500;

  /** In-flight CSRF fetch promise — deduplicates concurrent requests */
  private csrfFetchPromise: Promise<string | null> | null = null;

  constructor(config: BatchExecuteClientConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      retryBaseDelay: config.retryBaseDelay ?? 1000,
      debug: config.debug ?? false,
    };
  }

  /**
   * Set cookies for authentication
   *
   * @param cookies - Browser cookies from AuthManager
   */
  setCookies(cookies: Cookie[]): void {
    this.cookies = cookies;
    if (this.config.debug) {
      log.dim(`🍪 Set ${cookies.length} cookies for API client`);
    }
  }

  /**
   * Get current cookies
   */
  getCookies(): Cookie[] {
    return this.cookies;
  }

  /**
   * Check if client has valid authentication
   */
  hasValidAuth(): boolean {
    return csrfManager.hasRequiredCookies(this.cookies);
  }

  /**
   * Execute a single RPC request
   *
   * @param request - The RPC request to execute
   * @returns Batch response containing the result
   */
  async execute(request: RPCRequest): Promise<BatchExecuteResponse> {
    return this.executeBatch([request]);
  }

  /**
   * Execute multiple RPC requests in a single batch
   *
   * @param requests - Array of RPC requests
   * @returns Batch response containing all results
   */
  async executeBatch(requests: RPCRequest[]): Promise<BatchExecuteResponse> {
    // Guard: warn about duplicate RPC IDs in batch (responses may collide)
    const rpcIds = requests.map(r => r.rpcId);
    const uniqueIds = new Set(rpcIds);
    if (uniqueIds.size < rpcIds.length) {
      const dupes = rpcIds.filter((id, i) => rpcIds.indexOf(id) !== i);
      log.warning(`⚠️  Batch contains duplicate RPC IDs: ${[...new Set(dupes)].join(', ')}. Responses may be overwritten.`);
    }

    // Validate authentication
    if (!this.hasValidAuth()) {
      return {
        success: false,
        responses: new Map(),
        error: 'No valid authentication cookies. Please run setup_auth first.',
      };
    }

    // Rate limiting - ensure minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await this.sleep(this.MIN_REQUEST_INTERVAL - timeSinceLastRequest);
    }

    // Execute with retries
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.config.retryBaseDelay * Math.pow(2, attempt - 1);
          log.warning(`⏳ Retry attempt ${attempt + 1}/${this.config.maxRetries} after ${delay}ms`);
          await this.sleep(delay);
        }

        const response = await this.executeInternal(requests);
        this.lastRequestTime = Date.now();

        // Check for retriable errors
        if (!response.success) {
          if (isRateLimited(response)) {
            log.warning('⚠️  Rate limited, will retry...');
            lastError = new Error('Rate limited');
            continue;
          }

          if (isAuthError(response)) {
            // Auth errors are not retriable
            return response;
          }
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log.warning(`⚠️  Request failed: ${lastError.message}`);

        // Network errors are retriable
        if (lastError.message.includes('ETIMEDOUT') ||
            lastError.message.includes('ECONNRESET') ||
            lastError.message.includes('fetch failed')) {
          continue;
        }

        // Other errors are not retriable
        break;
      }
    }

    return {
      success: false,
      responses: new Map(),
      error: lastError?.message || 'Unknown error after all retries',
    };
  }

  /**
   * Internal execution method (no retries)
   */
  private async executeInternal(requests: RPCRequest[]): Promise<BatchExecuteResponse> {
    if (this.config.debug) {
      logRequests(requests);
    }

    // Build request components
    const rpcIds = requests.map((r) => r.rpcId);
    const url = buildEndpointURL(rpcIds);
    const cookieHeader = csrfManager.buildCookieHeader(this.cookies);
    const authHeader = csrfManager.generateSAPISIDHash(this.cookies);
    const headers = buildRequestHeaders(cookieHeader, authHeader);

    // Get or fetch CSRF token
    let atValue = csrfManager.getCachedToken();
    if (!atValue) {
      atValue = await this.fetchCSRFToken();
    }

    const body = buildRequestBody(requests, atValue || undefined);

    // Execute request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      log.info(`[executeInternal] HTTP ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        log.warning(`[executeInternal] HTTP error, raw: ${text.substring(0, 200)}`);
        return {
          success: false,
          responses: new Map(),
          rawResponse: text,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const responseText = await response.text();
      const parsed = parseBatchExecuteResponse(responseText);
      log.info(`[executeInternal] Parsed: success=${parsed.success} responses=${parsed.responses.size}`);

      if (this.config.debug) {
        logResponse(parsed);
      }

      return parsed;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch CSRF token from the NotebookLM page.
   *
   * Deduplicates concurrent callers — if a fetch is already in flight, all
   * concurrent callers await the same promise instead of triggering extra requests.
   */
  private async fetchCSRFToken(): Promise<string | null> {
    if (this.csrfFetchPromise) {
      return this.csrfFetchPromise;
    }

    this.csrfFetchPromise = this._fetchCSRFTokenInternal();
    try {
      return await this.csrfFetchPromise;
    } finally {
      this.csrfFetchPromise = null;
    }
  }

  /**
   * Internal CSRF fetch implementation (no concurrency guard)
   */
  private async _fetchCSRFTokenInternal(): Promise<string | null> {
    try {
      const cookieHeader = csrfManager.buildCookieHeader(this.cookies);

      const response = await fetch('https://notebooklm.google.com/', {
        method: 'GET',
        headers: {
          Cookie: cookieHeader,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        log.warning(`⚠️  Failed to fetch CSRF token: HTTP ${response.status}`);
        return null;
      }

      const html = await response.text();
      const token = csrfManager.extractTokenFromHTML(html);

      if (token) {
        csrfManager.setCachedToken(token);
        if (this.config.debug) {
          log.dim(`🔑 Extracted CSRF token (${token.length} chars)`);
        }
      }

      return token;
    } catch (error) {
      log.warning(`⚠️  Failed to fetch CSRF token: ${error}`);
      return null;
    }
  }

  /**
   * Refresh CSRF token (clear cache and fetch new)
   */
  async refreshCSRFToken(): Promise<string | null> {
    csrfManager.clearCache();
    return this.fetchCSRFToken();
  }

  /**
   * Clear cached CSRF token
   */
  clearCSRFToken(): void {
    csrfManager.clearCache();
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// High-Level API Methods
// ============================================================================

import {
  buildListNotebooksRequest,
  buildGetNotebookRequest,
  buildCreateNotebookRequest,
  buildDeleteNotebookRequest,
  buildRenameNotebookRequest,
  buildListSourcesRequest,
  buildAddURLSourceRequest,
  buildAddTextSourceRequest,
  buildAddYouTubeSourceRequest,
  buildAddDriveSourceRequest,
  buildDeleteSourceRequest,
  buildGetAudioStatusRequest,
  buildCreateAudioRequest,
  buildDeleteAudioRequest,
  buildGetAudioURLRequest,
  buildGenerateFAQRequest,
  buildGenerateBriefingRequest,
  buildGenerateTimelineRequest,
  buildGenerateStudyGuideRequest,
  buildGetSuggestionsRequest,
} from './request-builder.js';

import {
  parseNotebookList,
  parseCreateNotebookResponse,
  parseSourceList,
  parseAudioStatus,
  parseAudioURL,
  parseGeneratedContent,
  parseSuggestedQuestions,
  extractResponse,
  getFirstSuccessfulResponse,
} from './response-parser.js';

import type {
  APINotebook,
  APISource,
  APIAudioOverview,
} from './types.js';
import { RPC_IDS } from './rpc-ids.js';
import { ContentTypeCode } from './content-types.js';
import { generateAndWait, type GenerateAndWaitResult } from './operation-poller.js';

/**
 * Extended BatchExecute Client with high-level API methods
 */
export class NotebookLMAPIClient extends BatchExecuteClient {
  // ==========================================================================
  // Notebook Operations
  // ==========================================================================

  /**
   * List all notebooks for the authenticated user
   */
  async listNotebooks(): Promise<APINotebook[]> {
    const response = await this.execute(buildListNotebooksRequest());

    if (!response.success) {
      log.warning(`⚠️  Failed to list notebooks: ${response.error}`);
      return [];
    }

    const rpcResponse = extractResponse(response, RPC_IDS.LIST_NOTEBOOKS);
    if (!rpcResponse?.success || !rpcResponse.data) {
      // Try getting first response if specific one not found
      const firstResponse = getFirstSuccessfulResponse(response);
      if (firstResponse?.data) {
        return parseNotebookList(firstResponse.data);
      }
      return [];
    }

    return parseNotebookList(rpcResponse.data);
  }

  /**
   * Get a specific notebook by ID
   */
  async getNotebook(notebookId: string): Promise<APINotebook | null> {
    const response = await this.execute(buildGetNotebookRequest(notebookId));

    if (!response.success) {
      log.warning(`⚠️  Failed to get notebook: ${response.error}`);
      return null;
    }

    const rpcResponse = getFirstSuccessfulResponse(response);
    if (!rpcResponse?.success || !rpcResponse.data) {
      return null;
    }

    const data = rpcResponse.data as unknown[];
    if (!Array.isArray(data)) {
      return null;
    }

    return {
      id: notebookId,
      title: String(data[1] || 'Untitled notebook'),
      createdAt: typeof data[4] === 'number' ? data[4] : undefined,
      modifiedAt: typeof data[5] === 'number' ? data[5] : undefined,
    };
  }

  /**
   * Create a new notebook
   */
  async createNotebook(title?: string): Promise<string | null> {
    const response = await this.execute(buildCreateNotebookRequest(title));

    if (!response.success) {
      log.warning(`⚠️  Failed to create notebook: ${response.error}`);
      return null;
    }

    const rpcResponse = getFirstSuccessfulResponse(response);
    if (!rpcResponse?.success || !rpcResponse.data) {
      return null;
    }

    return parseCreateNotebookResponse(rpcResponse.data);
  }

  /**
   * Delete a notebook
   */
  async deleteNotebook(notebookId: string): Promise<boolean> {
    const response = await this.execute(buildDeleteNotebookRequest(notebookId));

    if (!response.success) {
      log.warning(`⚠️  Failed to delete notebook: ${response.error}`);
      return false;
    }

    return true;
  }

  /**
   * Rename a notebook
   */
  async renameNotebook(notebookId: string, newTitle: string): Promise<boolean> {
    const response = await this.execute(
      buildRenameNotebookRequest(notebookId, newTitle)
    );

    if (!response.success) {
      log.warning(`⚠️  Failed to rename notebook: ${response.error}`);
      return false;
    }

    return true;
  }

  // ==========================================================================
  // Source Operations
  // ==========================================================================

  /**
   * List all sources in a notebook
   */
  async listSources(notebookId: string): Promise<APISource[]> {
    const response = await this.execute(buildListSourcesRequest(notebookId));

    if (!response.success) {
      log.warning(`⚠️  Failed to list sources: ${response.error}`);
      return [];
    }

    const rpcResponse = getFirstSuccessfulResponse(response);
    if (!rpcResponse?.success || !rpcResponse.data) {
      return [];
    }

    return parseSourceList(rpcResponse.data);
  }

  /**
   * Add a URL source to a notebook
   */
  async addURLSource(notebookId: string, url: string): Promise<boolean> {
    const response = await this.execute(
      buildAddURLSourceRequest(notebookId, url)
    );

    if (!response.success) {
      log.warning(`⚠️  Failed to add URL source: ${response.error}`);
      return false;
    }

    return true;
  }

  /**
   * Add a text source to a notebook
   */
  async addTextSource(
    notebookId: string,
    title: string,
    content: string
  ): Promise<boolean> {
    const response = await this.execute(
      buildAddTextSourceRequest(notebookId, title, content)
    );

    if (!response.success) {
      log.warning(`⚠️  Failed to add text source: ${response.error}`);
      return false;
    }

    return true;
  }

  /**
   * Add a YouTube source to a notebook
   */
  async addYouTubeSource(notebookId: string, youtubeUrl: string): Promise<boolean> {
    const response = await this.execute(
      buildAddYouTubeSourceRequest(notebookId, youtubeUrl)
    );

    if (!response.success) {
      log.warning(`⚠️  Failed to add YouTube source: ${response.error}`);
      return false;
    }

    return true;
  }

  /**
   * Add a Google Drive source to a notebook
   */
  async addDriveSource(notebookId: string, fileId: string): Promise<boolean> {
    const response = await this.execute(
      buildAddDriveSourceRequest(notebookId, fileId)
    );

    if (!response.success) {
      log.warning(`⚠️  Failed to add Drive source: ${response.error}`);
      return false;
    }

    return true;
  }

  /**
   * Delete a source from a notebook
   */
  async deleteSource(notebookId: string, sourceId: string): Promise<boolean> {
    const response = await this.execute(
      buildDeleteSourceRequest(notebookId, sourceId)
    );

    if (!response.success) {
      log.warning(`⚠️  Failed to delete source: ${response.error}`);
      return false;
    }

    return true;
  }

  // ==========================================================================
  // Audio Operations
  // ==========================================================================

  /**
   * Get audio overview status for a notebook
   */
  async getAudioStatus(notebookId: string): Promise<APIAudioOverview> {
    const response = await this.execute(buildGetAudioStatusRequest(notebookId));

    if (!response.success) {
      return { status: 'not_created', error: response.error };
    }

    const rpcResponse = getFirstSuccessfulResponse(response);
    if (!rpcResponse?.success || !rpcResponse.data) {
      return { status: 'not_created' };
    }

    return parseAudioStatus(rpcResponse.data);
  }

  /**
   * Create/generate audio overview for a notebook
   */
  async createAudio(
    notebookId: string,
    customInstructions?: string
  ): Promise<boolean> {
    const response = await this.execute(
      buildCreateAudioRequest(notebookId, customInstructions)
    );

    if (!response.success) {
      log.warning(`⚠️  Failed to create audio: ${response.error}`);
      return false;
    }

    return true;
  }

  /**
   * Delete audio overview for a notebook
   */
  async deleteAudio(notebookId: string): Promise<boolean> {
    const response = await this.execute(buildDeleteAudioRequest(notebookId));

    if (!response.success) {
      log.warning(`⚠️  Failed to delete audio: ${response.error}`);
      return false;
    }

    return true;
  }

  /**
   * Get audio download URL for a notebook
   */
  async getAudioURL(notebookId: string): Promise<string | null> {
    const response = await this.execute(buildGetAudioURLRequest(notebookId));

    if (!response.success) {
      log.warning(`⚠️  Failed to get audio URL: ${response.error}`);
      return null;
    }

    const rpcResponse = getFirstSuccessfulResponse(response);
    if (!rpcResponse?.success || !rpcResponse.data) {
      return null;
    }

    return parseAudioURL(rpcResponse.data);
  }

  // ==========================================================================
  // Content Generation Operations
  // ==========================================================================

  /**
   * Generate FAQ from notebook sources
   */
  async generateFAQ(
    notebookId: string,
    sourceIds?: string[]
  ): Promise<string | null> {
    const response = await this.execute(
      buildGenerateFAQRequest(notebookId, sourceIds)
    );

    if (!response.success) {
      log.warning(`⚠️  Failed to generate FAQ: ${response.error}`);
      return null;
    }

    const rpcResponse = getFirstSuccessfulResponse(response);
    if (!rpcResponse?.success || !rpcResponse.data) {
      return null;
    }

    return parseGeneratedContent(rpcResponse.data);
  }

  /**
   * Generate briefing document from notebook sources
   */
  async generateBriefing(
    notebookId: string,
    sourceIds?: string[]
  ): Promise<string | null> {
    const response = await this.execute(
      buildGenerateBriefingRequest(notebookId, sourceIds)
    );

    if (!response.success) {
      log.warning(`⚠️  Failed to generate briefing: ${response.error}`);
      return null;
    }

    const rpcResponse = getFirstSuccessfulResponse(response);
    if (!rpcResponse?.success || !rpcResponse.data) {
      return null;
    }

    return parseGeneratedContent(rpcResponse.data);
  }

  /**
   * Generate timeline from notebook sources
   */
  async generateTimeline(
    notebookId: string,
    sourceIds?: string[]
  ): Promise<string | null> {
    const response = await this.execute(
      buildGenerateTimelineRequest(notebookId, sourceIds)
    );

    if (!response.success) {
      log.warning(`⚠️  Failed to generate timeline: ${response.error}`);
      return null;
    }

    const rpcResponse = getFirstSuccessfulResponse(response);
    if (!rpcResponse?.success || !rpcResponse.data) {
      return null;
    }

    return parseGeneratedContent(rpcResponse.data);
  }

  /**
   * Generate study guide from notebook sources
   */
  async generateStudyGuide(
    notebookId: string,
    sourceIds?: string[]
  ): Promise<string | null> {
    const response = await this.execute(
      buildGenerateStudyGuideRequest(notebookId, sourceIds)
    );

    if (!response.success) {
      log.warning(`⚠️  Failed to generate study guide: ${response.error}`);
      return null;
    }

    const rpcResponse = getFirstSuccessfulResponse(response);
    if (!rpcResponse?.success || !rpcResponse.data) {
      return null;
    }

    return parseGeneratedContent(rpcResponse.data);
  }

  // ==========================================================================
  // Q&A Operations
  // ==========================================================================

  /**
   * Get suggested questions for a notebook
   */
  async getSuggestedQuestions(notebookId: string): Promise<string[]> {
    const response = await this.execute(buildGetSuggestionsRequest(notebookId));

    if (!response.success) {
      log.warning(`⚠️  Failed to get suggestions: ${response.error}`);
      return [];
    }

    const rpcResponse = getFirstSuccessfulResponse(response);
    if (!rpcResponse?.success || !rpcResponse.data) {
      return [];
    }

    return parseSuggestedQuestions(rpcResponse.data);
  }

  // ==========================================================================
  // Batch Convenience Operations
  // ==========================================================================

  /**
   * Create a notebook and immediately add a text source in a single batch call.
   *
   * @param title - Notebook title
   * @param sourceTitle - Title for the text source
   * @param sourceContent - Content of the text source
   * @returns Created notebook ID or null on failure
   */
  async createNotebookWithSource(
    title: string,
    sourceTitle: string,
    sourceContent: string,
  ): Promise<{ notebookId: string | null; sourceAdded: boolean }> {
    // Step 1: create the notebook
    const notebookId = await this.createNotebook(title);
    if (!notebookId) {
      log.warning('⚠️  createNotebookWithSource: failed to create notebook');
      return { notebookId: null, sourceAdded: false };
    }

    // Step 2: add source — reuse existing single-call method
    const added = await this.addTextSource(notebookId, sourceTitle, sourceContent);
    if (!added) {
      log.warning(`⚠️  createNotebookWithSource: notebook created (${notebookId}) but source add failed`);
    }

    return { notebookId, sourceAdded: added };
  }

  /**
   * List notebooks and sources for a specific notebook in a single batch call.
   *
   * @param notebookId - Notebook whose sources to fetch
   * @returns Object containing notebooks list and sources list
   */
  async batchListNotebooksAndSources(
    notebookId: string,
  ): Promise<{ notebooks: APINotebook[]; sources: APISource[] }> {
    const requests = [
      buildListNotebooksRequest(),
      buildListSourcesRequest(notebookId),
    ];

    const response = await this.executeBatch(requests);

    const notebooks: APINotebook[] = [];
    const sources: APISource[] = [];

    if (!response.success) {
      log.warning(`⚠️  batchListNotebooksAndSources failed: ${response.error}`);
      return { notebooks, sources };
    }

    // Parse notebooks from LIST_NOTEBOOKS response
    const nbResponse = response.responses.get(RPC_IDS.LIST_NOTEBOOKS);
    if (nbResponse?.success && nbResponse.data) {
      notebooks.push(...parseNotebookList(nbResponse.data));
    } else {
      const first = getFirstSuccessfulResponse(response);
      if (first?.data) notebooks.push(...parseNotebookList(first.data));
    }

    // Parse sources from LIST_SOURCES response
    const srcResponse = response.responses.get(RPC_IDS.LIST_SOURCES);
    if (srcResponse?.success && srcResponse.data) {
      sources.push(...parseSourceList(srcResponse.data));
    }

    return { notebooks, sources };
  }

  // ==========================================================================
  // Async Generation with Polling
  // ==========================================================================

  /**
   * Generate content and wait for it to be ready.
   *
   * Triggers generation via R7cb6c then polls gArtLc until the artifact
   * status reaches COMPLETED (status 3) or the timeout is exceeded.
   *
   * @param notebookId - Target notebook ID
   * @param contentType - Content type code from ContentTypeCode
   * @param sourceIds - Optional source ID filter
   * @param maxWaitMs - Maximum polling duration in ms (default: 120_000)
   * @returns GenerateAndWaitResult with content when successful
   */
  async generateAndWait(
    notebookId: string,
    contentType: ContentTypeCode,
    sourceIds?: string[],
    maxWaitMs = 120_000,
  ): Promise<GenerateAndWaitResult> {
    return generateAndWait(this, notebookId, contentType, sourceIds, maxWaitMs);
  }
}

// Export singleton factory function
let clientInstance: NotebookLMAPIClient | null = null;

/**
 * Get or create the API client instance.
 *
 * Note: This is a singleton. If an instance already exists and a new config
 * is passed, the config is ignored. Call resetAPIClient() first to apply new config.
 */
export function getAPIClient(config?: BatchExecuteClientConfig): NotebookLMAPIClient {
  if (!clientInstance) {
    clientInstance = new NotebookLMAPIClient(config);
  } else if (config) {
    // Warn when caller passes config to an already-initialized singleton (config is silently ignored)
    log.dim('⚠️  API client already initialized; ignoring new config. Use resetAPIClient() first.');
  }
  return clientInstance;
}

/**
 * Reset the API client (for testing or re-auth)
 */
export function resetAPIClient(): void {
  clientInstance = null;
}
