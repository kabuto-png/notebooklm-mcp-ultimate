/**
 * Debug script to test source operations via Browser UI
 */
import { AuthManager } from '../src/auth/auth-manager.js';
import { SessionManager } from '../src/session/session-manager.js';

async function main() {
  const notebookUrl = 'https://notebooklm.google.com/notebook/5d23edd6-9631-46f9-880d-faabde4ebf58';

  // Create session manager and browser session
  console.log('=== Creating browser session ===');
  const authManager = new AuthManager();
  const sessionManager = new SessionManager(authManager);

  const session = await sessionManager.getOrCreateSession(undefined, notebookUrl);
  console.log(`Session created: ${session.sessionId}\n`);

  // List sources via browser UI BEFORE
  console.log('=== Sources BEFORE (via Browser UI) ===');
  const sourcesBefore = await session.listSourcesViaUI();
  console.log(`Count: ${sourcesBefore.length}`);
  sourcesBefore.forEach(s => console.log(`  - ${s.title}`));

  // Add file source via browser UI
  console.log('\n=== Adding file source via Browser UI ===');
  const testPdfPath = '/tmp/test-notebooklm.pdf';

  try {
    const added = await session.addFileSourceViaUI(testPdfPath);
    console.log(`Add result: ${added}`);
  } catch (err) {
    console.error('Failed to add source:', err);
  }

  // Wait for processing
  console.log('\nWaiting 3 seconds...');
  await new Promise(r => setTimeout(r, 3000));

  // List sources via browser UI AFTER
  console.log('\n=== Sources AFTER (via Browser UI) ===');
  const sourcesAfter = await session.listSourcesViaUI();
  console.log(`Count: ${sourcesAfter.length}`);
  sourcesAfter.forEach(s => console.log(`  - ${s.title}`));

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Sources before: ${sourcesBefore.length}`);
  console.log(`Sources after: ${sourcesAfter.length}`);
  console.log(`New sources: ${sourcesAfter.length - sourcesBefore.length}`);

  // Cleanup
  await session.close();
}

main().catch(console.error);
