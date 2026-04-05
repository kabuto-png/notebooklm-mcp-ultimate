/**
 * Test Setup and Utilities
 *
 * Provides shared infrastructure for integration tests:
 * - AuthManager, SessionManager, ToolHandlers initialization
 * - Test notebook management
 * - Verification utilities
 */

import { AuthManager } from '../src/auth/auth-manager.js';
import { SessionManager } from '../src/session/session-manager.js';
import { NotebookLibrary } from '../src/library/notebook-library.js';
import { ToolHandlers } from '../src/tools/handlers.js';
import { CONFIG } from '../src/config.js';

export interface TestContext {
  authManager: AuthManager;
  sessionManager: SessionManager;
  library: NotebookLibrary;
  toolHandlers: ToolHandlers;
  testNotebookId?: string;
  testSessionId?: string;
}

let testContext: TestContext | null = null;

/**
 * Initialize test context (singleton)
 */
export async function getTestContext(): Promise<TestContext> {
  if (testContext) return testContext;

  const authManager = new AuthManager();
  const sessionManager = new SessionManager(authManager);
  const library = new NotebookLibrary();
  const toolHandlers = new ToolHandlers(sessionManager, authManager, library);

  testContext = {
    authManager,
    sessionManager,
    library,
    toolHandlers,
  };

  return testContext;
}

/**
 * Check if authentication is available
 */
export async function isAuthAvailable(): Promise<boolean> {
  const ctx = await getTestContext();
  const health = await ctx.toolHandlers.handleGetHealth();
  return health.success && health.data?.authenticated === true;
}

/**
 * Get or create a test notebook
 * Returns notebook ID for subsequent tests
 */
export async function getOrCreateTestNotebook(): Promise<string> {
  const ctx = await getTestContext();

  // Check if test notebook already exists in library
  const notebooks = ctx.library.listNotebooks();

  // First, look for existing test notebook
  const testNotebook = notebooks.find(n => n.name.startsWith('[TEST]'));
  if (testNotebook) {
    ctx.testNotebookId = testNotebook.id;
    return testNotebook.id;
  }

  // Otherwise, use any existing notebook (prefer active)
  const active = ctx.library.getActiveNotebook();
  if (active) {
    ctx.testNotebookId = active.id;
    return active.id;
  }

  // Use first notebook in library
  if (notebooks.length > 0) {
    ctx.testNotebookId = notebooks[0].id;
    return notebooks[0].id;
  }

  // Last resort: try to create new notebook via remote API
  const result = await ctx.toolHandlers.handleCreateNotebookRemote({
    title: '[TEST] Integration Test Notebook',
  });

  if (!result.success || !result.data?.notebook_id) {
    throw new Error(`Failed to create test notebook: ${result.error}. No notebooks in library.`);
  }

  ctx.testNotebookId = result.data.notebook_id;
  return result.data.notebook_id;
}

/**
 * Cleanup test notebook
 */
export async function cleanupTestNotebook(): Promise<void> {
  const ctx = await getTestContext();
  if (!ctx.testNotebookId) return;

  try {
    await ctx.toolHandlers.handleDeleteNotebookRemote({
      notebook_id: ctx.testNotebookId,
    });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Verify notebook exists in NotebookLM
 */
export async function verifyNotebookExists(notebookId: string): Promise<boolean> {
  const ctx = await getTestContext();
  const result = await ctx.toolHandlers.handleGetNotebook({ id: notebookId });
  return result.success && result.data?.notebook !== undefined;
}

/**
 * Verify source exists in notebook
 */
export async function verifySourceExists(
  notebookId: string,
  sourceTitle: string
): Promise<boolean> {
  const ctx = await getTestContext();
  const result = await ctx.toolHandlers.handleListSources({ notebook_id: notebookId }) as {
    success: boolean;
    sources?: { title?: string }[];
  };

  if (!result.success || !result.sources) return false;

  return result.sources.some(
    (s: { title?: string }) => s.title?.includes(sourceTitle)
  );
}

/**
 * Verify answer was received (not empty, not error)
 */
export function verifyValidAnswer(answer?: string): boolean {
  if (!answer) return false;
  if (answer.length < 10) return false;
  if (answer.toLowerCase().includes('error')) return false;
  return true;
}

/**
 * Wait with timeout
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Cleanup all sessions after tests
 */
export async function cleanupAllSessions(): Promise<void> {
  const ctx = await getTestContext();
  const sessions = await ctx.toolHandlers.handleListSessions();

  if (sessions.success && sessions.data?.sessions) {
    for (const session of sessions.data.sessions) {
      try {
        await ctx.toolHandlers.handleCloseSession({ session_id: session.session_id });
      } catch {
        // Ignore
      }
    }
  }
}
