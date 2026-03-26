/**
 * RPC ID Constants for NotebookLM Internal API
 *
 * These IDs are used in the batchexecute endpoint to identify which
 * operation to perform. They were reverse-engineered from the NotebookLM
 * web application.
 *
 * Note: These IDs may change when Google updates NotebookLM. If operations
 * start failing, check the network tab in DevTools for new IDs.
 */

export const RPC_IDS = {
  // ============================================================================
  // Notebook Operations
  // ============================================================================

  /** List all notebooks for the current user */
  LIST_NOTEBOOKS: 'wXbhsf',

  /** Get details for a specific notebook */
  GET_NOTEBOOK: 'rLM1Ne',

  /** Create a new notebook */
  CREATE_NOTEBOOK: 'CCqFvf',

  /** Delete a notebook */
  DELETE_NOTEBOOK: 'WWINqb',

  /** Rename a notebook */
  RENAME_NOTEBOOK: 's0tc2d',

  /** Clone/duplicate a notebook */
  CLONE_NOTEBOOK: 'tncJOd',

  // ============================================================================
  // Source Operations
  // ============================================================================

  /** List all sources in a notebook */
  LIST_SOURCES: 'hPTbtc',

  /** Add a URL source (same RPC as text source — type determined by args) */
  ADD_URL_SOURCE: 'izAoDd',

  /** Add a text/paste source */
  ADD_TEXT_SOURCE: 'izAoDd',

  /** Add a YouTube source */
  ADD_YOUTUBE_SOURCE: 'n8xVHd',

  /** Add a Google Drive source */
  ADD_DRIVE_SOURCE: 'Y7Ryrc',

  /** Delete a source */
  DELETE_SOURCE: 'tGMBJ',

  /** Get source details/summary */
  GET_SOURCE: 'hizoJc',

  /** Refresh/re-process a source */
  REFRESH_SOURCE: 'xLG2Ue',

  // ============================================================================
  // Audio Studio Operations
  // ============================================================================

  /** Get audio overview status (now part of unified content gen) */
  GET_AUDIO_STATUS: 'R7cb6c',

  /** Create/generate audio overview (unified content gen, type=1) */
  CREATE_AUDIO: 'R7cb6c',

  /** Update audio configuration */
  UPDATE_AUDIO: 'hJXYGe',

  /** Delete audio overview */
  DELETE_AUDIO: 'pzGYuc',

  /** Get audio download URL */
  GET_AUDIO_URL: 'NkDhJc',

  // ============================================================================
  // Content Generation Operations (unified RPC: R7cb6c with type codes)
  // Type codes: 1=Audio, 2=StudyGuide(?), 3=Briefing(?), 4=Flashcards, 5=Quiz(?), 6=FAQ(?)
  // ============================================================================

  /** Generate FAQ from sources */
  GENERATE_FAQ: 'R7cb6c',

  /** Generate briefing document */
  GENERATE_BRIEFING: 'R7cb6c',

  /** Generate timeline */
  GENERATE_TIMELINE: 'R7cb6c',

  /** Generate outline */
  GENERATE_OUTLINE: 'R7cb6c',

  /** Generate study guide */
  GENERATE_STUDY_GUIDE: 'R7cb6c',

  /** Generate flashcards (type=4) */
  GENERATE_FLASHCARDS: 'R7cb6c',

  // ============================================================================
  // Q&A Operations
  // ============================================================================

  /** Send a question (alternative to browser) */
  SEND_QUESTION: 'xvuNWd',

  /** Get suggested follow-up questions */
  GET_SUGGESTIONS: 'JT0DSd',

  /** Get conversation history */
  GET_HISTORY: 'rYoaob',

  // ============================================================================
  // Research Operations
  // ============================================================================

  /** Discover related sources */
  DISCOVER_SOURCES: 'Yn4p8',

  /** Import a discovered source */
  IMPORT_SOURCE: 'cDkE8b',

  // ============================================================================
  // User/Settings Operations
  // ============================================================================

  /** Get user settings */
  GET_USER_SETTINGS: 'pbYDYb',

  /** Update user settings */
  UPDATE_USER_SETTINGS: 'wJbG8d',

  /** Get usage stats */
  GET_USAGE_STATS: 'g0kOxd',
} as const;

/**
 * Type for RPC ID values
 */
export type RPCId = typeof RPC_IDS[keyof typeof RPC_IDS];

/**
 * Map of RPC IDs to human-readable names (for logging)
 * Note: Multiple operations share the same RPC ID (e.g., R7cb6c for all content gen)
 */
export const RPC_NAMES: Record<string, string> = {
  'wXbhsf': 'List Notebooks',
  'rLM1Ne': 'Get Notebook',
  'CCqFvf': 'Create Notebook',
  'WWINqb': 'Delete Notebook',
  's0tc2d': 'Rename Notebook',
  'tncJOd': 'Clone Notebook',
  'hPTbtc': 'List Sources',
  'izAoDd': 'Add Source (Text/URL)',
  'n8xVHd': 'Add YouTube Source',
  'Y7Ryrc': 'Add Drive Source',
  'tGMBJ': 'Delete Source',
  'hizoJc': 'Get Source',
  'xLG2Ue': 'Refresh Source',
  'R7cb6c': 'Content Generation (Audio/FAQ/Flashcards/etc.)',
  'hJXYGe': 'Update Audio',
  'pzGYuc': 'Delete Audio',
  'NkDhJc': 'Get Audio URL',
  'xvuNWd': 'Send Question',
  'JT0DSd': 'Get Suggestions',
  'rYoaob': 'Get History',
  'Yn4p8': 'Discover Sources',
  'cDkE8b': 'Import Source',
  'pbYDYb': 'Get User Settings',
  'wJbG8d': 'Update User Settings',
  'g0kOxd': 'Get Usage Stats',
};

/**
 * Get human-readable name for an RPC ID
 */
export function getRPCName(rpcId: string): string {
  return (RPC_NAMES as Record<string, string>)[rpcId] || `Unknown (${rpcId})`;
}
