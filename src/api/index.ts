/**
 * NotebookLM Internal API Module
 *
 * This module provides direct API access to NotebookLM without browser automation.
 * It's faster for many operations but requires valid authentication cookies.
 *
 * Usage:
 * ```typescript
 * import { getAPIClient, initializeAPIClientWithCookies, cookieStore } from './api/index.js';
 *
 * // Initialize client with cookies
 * const client = getAPIClient();
 * await initializeAPIClientWithCookies(client);
 *
 * // Use the client
 * const notebooks = await client.listNotebooks();
 * ```
 */

// Core client
export {
  BatchExecuteClient,
  NotebookLMAPIClient,
  getAPIClient,
  resetAPIClient,
  type BatchExecuteClientConfig,
} from './batch-execute-client.js';

// Types
export type {
  // Request types
  RPCRequest,
  APIRequestConfig,
  Cookie,
  // Response types
  BatchExecuteResponse,
  RPCResponse,
  // Notebook types
  APINotebook,
  CreateNotebookRequest,
  RenameNotebookRequest,
  // Source types
  SourceType,
  APISource,
  AddURLSourceRequest,
  AddTextSourceRequest,
  AddYouTubeSourceRequest,
  AddDriveSourceRequest,
  // Audio types
  AudioStatus,
  AudioConfig,
  APIAudioOverview,
  // Content types
  ContentType,
  GeneratedContent,
  GenerateContentRequest,
  // Research types
  DiscoveredSource,
  DiscoverSourcesRequest,
  // Q&A types
  SuggestedQuestion,
  QuestionResponse,
  Citation,
  // Error types
  APIError,
  APIErrorCode,
} from './types.js';

export { API_ERROR_CODES } from './types.js';

// RPC IDs
export { RPC_IDS, RPC_NAMES, getRPCName, type RPCId } from './rpc-ids.js';

// CSRF Manager
export { CSRFManager, csrfManager } from './csrf-manager.js';

// Request Builder
export {
  buildSingleRequest,
  buildBatchPayload,
  buildRequestBody,
  buildRequestHeaders,
  buildEndpointURL,
  // Notebook requests
  buildListNotebooksRequest,
  buildGetNotebookRequest,
  buildCreateNotebookRequest,
  buildDeleteNotebookRequest,
  buildRenameNotebookRequest,
  // Source requests
  buildListSourcesRequest,
  buildAddURLSourceRequest,
  buildAddTextSourceRequest,
  buildAddYouTubeSourceRequest,
  buildAddDriveSourceRequest,
  buildDeleteSourceRequest,
  buildGetSourceRequest,
  // Audio requests
  buildGetAudioStatusRequest,
  buildCreateAudioRequest,
  buildDeleteAudioRequest,
  buildGetAudioURLRequest,
  // Content generation requests
  buildGenerateFAQRequest,
  buildGenerateBriefingRequest,
  buildGenerateTimelineRequest,
  buildGenerateStudyGuideRequest,
  // Q&A requests
  buildGetSuggestionsRequest,
  // Utilities
  logRequests,
} from './request-builder.js';

// Response Parser
export {
  parseBatchExecuteResponse,
  extractResponse,
  getFirstSuccessfulResponse,
  // Notebook parsing
  parseNotebookList,
  parseNotebookItem,
  parseCreateNotebookResponse,
  // Source parsing
  parseSourceList,
  parseSourceItem,
  // Audio parsing
  parseAudioStatus,
  parseAudioURL,
  // Content parsing
  parseGeneratedContent,
  // Q&A parsing
  parseSuggestedQuestions,
  // Error checking
  isAuthError,
  isRateLimited,
  logResponse,
} from './response-parser.js';

// Re-export from cookie store
export {
  CookieStore,
  cookieStore,
  initializeAPIClientWithCookies,
} from '../auth/cookie-store.js';
