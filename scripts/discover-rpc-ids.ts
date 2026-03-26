/**
 * RPC ID Discovery Script
 *
 * Uses Playwright to load NotebookLM, perform key operations, and capture
 * the RPC IDs used in batchexecute requests. Compares captured IDs against
 * the constants in src/api/rpc-ids.ts and outputs a diff report.
 *
 * Usage: npm run discover-rpc
 * Requires: a logged-in Chrome profile at ~/.local/share/notebooklm-mcp/chrome_profile
 */

import { chromium } from 'patchright';
import path from 'path';
import os from 'os';

// ============================================================================
// Known RPC IDs from src/api/rpc-ids.ts
// ============================================================================
const KNOWN_RPC_IDS: Record<string, string> = {
  wXbhsf: 'LIST_NOTEBOOKS',
  rLM1Ne: 'GET_NOTEBOOK',
  CCqFvf: 'CREATE_NOTEBOOK',
  WWINqb: 'DELETE_NOTEBOOK',
  s0tc2d: 'RENAME_NOTEBOOK',
  tncJOd: 'CLONE_NOTEBOOK',
  hPTbtc: 'LIST_SOURCES',
  izAoDd: 'ADD_SOURCE (Text/URL)',
  n8xVHd: 'ADD_YOUTUBE_SOURCE',
  Y7Ryrc: 'ADD_DRIVE_SOURCE',
  tGMBJ: 'DELETE_SOURCE',
  hizoJc: 'GET_SOURCE',
  xLG2Ue: 'REFRESH_SOURCE',
  R7cb6c: 'CONTENT_GENERATION (unified)',
  hJXYGe: 'UPDATE_AUDIO',
  pzGYuc: 'DELETE_AUDIO',
  NkDhJc: 'GET_AUDIO_URL',
  xvuNWd: 'SEND_QUESTION',
  JT0DSd: 'GET_SUGGESTIONS',
  rYoaob: 'GET_HISTORY',
  Yn4p8: 'DISCOVER_SOURCES',
  cDkE8b: 'IMPORT_SOURCE',
  pbYDYb: 'GET_USER_SETTINGS',
  wJbG8d: 'UPDATE_USER_SETTINGS',
  g0kOxd: 'GET_USAGE_STATS',
  gArtLc: 'LIST_ARTIFACTS',
};

/** Operations to perform during discovery */
type OperationName =
  | 'page_load'
  | 'create_notebook'
  | 'add_text_source'
  | 'rename_notebook'
  | 'delete_source'
  | 'delete_notebook'
  | 'generate_flashcards';

interface CapturedRPC {
  rpcId: string;
  operation: OperationName;
  timestamp: number;
}

interface DiscoveryReport {
  capturedAt: string;
  totalCaptured: number;
  newIds: string[];
  confirmedIds: string[];
  notSeenIds: string[];
  details: CapturedRPC[];
}

// ============================================================================
// Helpers
// ============================================================================

function getChromiumProfilePath(): string {
  return path.join(
    os.homedir(),
    '.local/share/notebooklm-mcp/chrome_profile',
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Main Discovery Logic
// ============================================================================

async function discoverRPCIds(): Promise<void> {
  const profileDir = getChromiumProfilePath();
  console.log(`\n🔍 NotebookLM RPC ID Discovery`);
  console.log(`   Chrome profile: ${profileDir}\n`);

  const captured: CapturedRPC[] = [];
  let currentOperation: OperationName = 'page_load';

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  // Intercept all batchexecute requests
  await page.route('**/batchexecute**', async (route) => {
    const request = route.request();
    try {
      const body = request.postData() || '';
      // Extract rpcids from query string
      const url = new URL(request.url());
      const rpcIds = url.searchParams.get('rpcids') || '';
      for (const id of rpcIds.split(',').filter(Boolean)) {
        captured.push({ rpcId: id.trim(), operation: currentOperation, timestamp: Date.now() });
      }
      // Also extract from f.req body
      const fReq = new URLSearchParams(body).get('f.req') || '';
      if (fReq) {
        try {
          const parsed = JSON.parse(fReq);
          if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
            for (const call of parsed[0]) {
              if (Array.isArray(call) && typeof call[0] === 'string') {
                const id = call[0].trim();
                if (id && !captured.some((c) => c.rpcId === id && c.operation === currentOperation)) {
                  captured.push({ rpcId: id, operation: currentOperation, timestamp: Date.now() });
                }
              }
            }
          }
        } catch {
          // ignore parse errors
        }
      }
    } catch {
      // ignore interception errors
    }
    await route.continue();
  });

  let createdNotebookId: string | null = null;
  let createdSourceId: string | null = null;

  try {
    // ---- Page load ----
    currentOperation = 'page_load';
    console.log('📄 Loading NotebookLM...');
    await page.goto('https://notebooklm.google.com/', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);

    // ---- Create notebook ----
    currentOperation = 'create_notebook';
    console.log('📓 Creating test notebook...');
    // Try to find and click "New notebook" button
    const newNbBtn = page.locator('button:has-text("New notebook"), button:has-text("Create")').first();
    if (await newNbBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newNbBtn.click();
      await sleep(3000);
      // Look for notebook ID in URL
      const url = page.url();
      const match = url.match(/\/notebook\/([^/?#]+)/);
      if (match) createdNotebookId = match[1];
    }
    console.log(`   Notebook ID: ${createdNotebookId || '(not found in URL)'}`);

    // ---- Add text source ----
    if (createdNotebookId) {
      currentOperation = 'add_text_source';
      console.log('📝 Adding text source...');
      // Look for "Add source" or paste text option
      const addSourceBtn = page.locator('button:has-text("Add source"), [aria-label*="add source"]').first();
      if (await addSourceBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addSourceBtn.click();
        await sleep(1000);
        // Try text/paste option
        const pasteBtn = page.locator('button:has-text("Paste"), button:has-text("Text")').first();
        if (await pasteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await pasteBtn.click();
          await sleep(500);
          const textarea = page.locator('textarea').first();
          if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
            await textarea.fill('This is a test source for RPC ID discovery. It contains sample content.');
            const confirmBtn = page.locator('button:has-text("Insert"), button:has-text("Add"), button[type="submit"]').first();
            if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await confirmBtn.click();
              await sleep(3000);
            }
          }
        }
      }
    }

    // ---- Rename notebook ----
    if (createdNotebookId) {
      currentOperation = 'rename_notebook';
      console.log('✏️  Renaming notebook...');
      const titleEl = page.locator('[data-testid="notebook-title"], h1[contenteditable]').first();
      if (await titleEl.isVisible({ timeout: 5000 }).catch(() => false)) {
        await titleEl.click();
        await page.keyboard.selectAll();
        await page.keyboard.type('RPC Discovery Test Notebook');
        await page.keyboard.press('Enter');
        await sleep(2000);
      }
    }

    // ---- Generate flashcards ----
    if (createdNotebookId) {
      currentOperation = 'generate_flashcards';
      console.log('🃏 Triggering flashcard generation...');
      const flashcardsBtn = page.locator('button:has-text("Flashcards"), [aria-label*="flashcard"]').first();
      if (await flashcardsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await flashcardsBtn.click();
        await sleep(3000);
        await page.keyboard.press('Escape');
      }
    }

    // ---- Delete source ----
    if (createdNotebookId && createdSourceId) {
      currentOperation = 'delete_source';
      console.log('🗑️  Deleting source...');
      const deleteSourceBtn = page.locator(`[data-source-id="${createdSourceId}"] button[aria-label*="delete"]`).first();
      if (await deleteSourceBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deleteSourceBtn.click();
        await sleep(2000);
      }
    }

    // ---- Delete notebook ----
    if (createdNotebookId) {
      currentOperation = 'delete_notebook';
      console.log('🗑️  Deleting test notebook...');
      await page.goto('https://notebooklm.google.com/', { waitUntil: 'networkidle', timeout: 15000 });
      await sleep(1000);
      const nbCard = page.locator(`[href*="${createdNotebookId}"]`).first();
      if (await nbCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nbCard.hover();
        const menuBtn = page.locator(`[href*="${createdNotebookId}"] ~ button, [href*="${createdNotebookId}"] button`).first();
        if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await menuBtn.click();
          await sleep(500);
          const deleteOption = page.locator('button:has-text("Delete"), [role="menuitem"]:has-text("Delete")').first();
          if (await deleteOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            await deleteOption.click();
            await sleep(1000);
            const confirmBtn = page.locator('button:has-text("Delete"), button:has-text("Confirm")').last();
            if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await confirmBtn.click();
              await sleep(2000);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`\n❌ Discovery error: ${error}`);
  } finally {
    await context.close();
  }

  // ============================================================================
  // Build and print report
  // ============================================================================
  const capturedIds = new Set(captured.map((c) => c.rpcId));
  const knownIds = new Set(Object.keys(KNOWN_RPC_IDS));

  const confirmedIds = [...capturedIds].filter((id) => knownIds.has(id));
  const newIds = [...capturedIds].filter((id) => !knownIds.has(id));
  const notSeenIds = [...knownIds].filter((id) => !capturedIds.has(id));

  const report: DiscoveryReport = {
    capturedAt: new Date().toISOString(),
    totalCaptured: capturedIds.size,
    newIds,
    confirmedIds,
    notSeenIds,
    details: captured,
  };

  console.log('\n' + '='.repeat(60));
  console.log('📊 RPC ID DISCOVERY REPORT');
  console.log('='.repeat(60));
  console.log(`Captured at: ${report.capturedAt}`);
  console.log(`Total unique IDs captured: ${report.totalCaptured}`);

  if (confirmedIds.length > 0) {
    console.log(`\n✅ CONFIRMED (still valid, ${confirmedIds.length}):`);
    for (const id of confirmedIds) {
      const ops = captured.filter((c) => c.rpcId === id).map((c) => c.operation);
      console.log(`   ${id.padEnd(12)} → ${KNOWN_RPC_IDS[id]} (seen in: ${[...new Set(ops)].join(', ')})`);
    }
  }

  if (newIds.length > 0) {
    console.log(`\n🆕 NEW IDs (not in rpc-ids.ts, ${newIds.length}):`);
    for (const id of newIds) {
      const ops = captured.filter((c) => c.rpcId === id).map((c) => c.operation);
      console.log(`   ${id.padEnd(12)} (seen in: ${[...new Set(ops)].join(', ')})`);
    }
  } else {
    console.log('\n✅ No new unknown IDs found.');
  }

  if (notSeenIds.length > 0) {
    console.log(`\n⚠️  NOT SEEN (may have changed, ${notSeenIds.length}):`);
    for (const id of notSeenIds) {
      console.log(`   ${id.padEnd(12)} → ${KNOWN_RPC_IDS[id]}`);
    }
  } else {
    console.log('\n✅ All known IDs were observed.');
  }

  console.log('\n' + '='.repeat(60));

  if (newIds.length > 0) {
    console.log('\n📋 Suggested additions to src/api/rpc-ids.ts:');
    for (const id of newIds) {
      const ops = captured.filter((c) => c.rpcId === id).map((c) => c.operation);
      console.log(`  UNKNOWN_${id.toUpperCase()}: '${id}', // seen in: ${[...new Set(ops)].join(', ')}`);
    }
  }
}

discoverRPCIds().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
