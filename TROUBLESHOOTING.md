## Troubleshooting

### Fresh start / Deep cleanup
If you're experiencing persistent issues, corrupted data, or want to start completely fresh:

**⚠️ CRITICAL: Close ALL Chrome/Chromium instances before cleanup!** Open browsers can prevent cleanup and cause issues.

**Recommended workflow:**
1. Close all Chrome/Chromium windows and instances
2. Ask: "Run NotebookLM cleanup and preserve my library"
3. Review the preview - you'll see exactly what will be deleted
4. Confirm deletion
5. Re-authenticate: "Open NotebookLM auth setup"

**What gets cleaned:**
- Browser data, cache, Chrome profiles
- Temporary files and logs
- Old installation data
- **Preserved:** Your notebook library (when using preserve option)

**Useful for:**
- Authentication problems
- Browser session conflicts
- Corrupted browser profiles
- Clean reinstalls
- Switching between accounts

### Browser closed / `newPage` errors
- Symptom: `browserContext.newPage: Target page/context/browser has been closed`.
- Fix: The server auto‑recovers (recreates context and page). Re‑run the tool.

### Profile lock / `ProcessSingleton` errors
- Cause: Another Chrome is using the base profile.
- Fix: `NOTEBOOK_PROFILE_STRATEGY=auto` (default) falls back to isolated per‑instance profiles; or set `isolated`.

### Authentication issues
**Quick fix:** Ask the agent to repair authentication; it will run `get_health` → `setup_auth` → `get_health`.

**For persistent auth failures:**
1. Close ALL Chrome/Chromium instances
2. Ask: "Run NotebookLM cleanup with library preservation"
3. After cleanup completes, ask: "Open NotebookLM auth setup"
4. This creates a completely fresh browser session while keeping your notebooks

**Auto-login (optional):**
- Set `AUTO_LOGIN_ENABLED=true` with `LOGIN_EMAIL`, `LOGIN_PASSWORD` environment variables
- For automation workflows only

### Typing speed too slow/fast
- Adjust `TYPING_WPM_MIN`/`MAX`; or disable stealth typing by setting `STEALTH_ENABLED=false`.

### Rate limit reached
- Symptom: "NotebookLM rate limit reached (50 queries/day for free accounts)".
- Fix: Use `re_auth` tool to switch to a different Google account, or wait until tomorrow.
- Upgrade: Google AI Pro/Ultra gives 5x higher limits.

### No notebooks found
- Ask to add the NotebookLM link you need.
- Ask to list the stored notebooks, then choose the one to activate.

---

## Content Generation Troubleshooting

### Content generation tools fail
**Symptom:** `generate_faq`, `generate_briefing`, etc. return errors.

**Causes and fixes:**
1. **No active notebook**
   - Explicitly specify `notebook_id` parameter
   - Or use `select_notebook` to set active notebook

2. **Insufficient source content**
   - Notebook may have minimal content
   - Add more sources using `add_url_source`, `add_text_source`, etc.
   - Generate requires at least ~1000 words of content

3. **Source format unsupported**
   - Some exotic file types may not parse correctly
   - Try re-adding as text content with `add_text_source`

**Solution:** Check `list_sources` and `summarize_source` to verify content is indexed.

### Generated content is sparse or incomplete
**Cause:** Sources may be incomplete or not fully indexed.

**Fix:**
1. Verify sources with `list_sources` and `summarize_source`
2. Wait 30 seconds after adding sources before generating
3. Try generating on subset using `source_ids` parameter
4. Add more comprehensive sources

---

## Audio Studio Troubleshooting

### Audio generation stuck or slow
**Symptom:** `create_audio` doesn't complete; stuck in "generating" state.

**Cause:** Audio generation is asynchronous and takes 2-5 minutes.

**Fix:**
1. Use `get_audio_status` to check progress
2. Check with agent later: "Check audio generation status"
3. If truly stuck (> 10 minutes), try `delete_audio` then `create_audio` again

### Audio download URL expired
**Symptom:** `download_audio` returns 404 or expired URL.

**Cause:** Generated URLs are temporary (expires after hours).

**Fix:**
1. Regenerate audio: `delete_audio` → `create_audio`
2. Get fresh URL: `download_audio`

### Audio quality poor or off-topic
**Symptom:** Generated audio discusses wrong topics or low quality.

**Cause:** Notebook sources may be insufficient or conflicting.

**Fix:**
1. Verify sources: `list_sources`
2. Remove irrelevant sources: `delete_source`
3. Add focused sources specific to topic
4. Regenerate with `update_audio` specifying `focus_topics` and `custom_instructions`

---

## Source Management Troubleshooting

### Add URL source fails
**Symptom:** `add_url_source` returns error; URL not added.

**Causes:**
1. **URL not accessible** - Site blocked or requires authentication
   - Try different source type: use `add_text_source` to manually paste content
   - Or use `add_youtube_source` / `add_drive_source` for those platforms

2. **Unsupported content type**
   - Complex JavaScript sites may not parse
   - PDFs inside paywalls won't work
   - Solution: Download PDF, then use `add_text_source`

3. **Too large file**
   - Very large PDFs may timeout
   - Split into multiple sources or use `add_text_source` for excerpts

### YouTube source has no captions
**Symptom:** `add_youtube_source` fails.

**Cause:** Video doesn't have captions or subtitles enabled.

**Fix:**
1. Check YouTube video—captions must be available
2. Some videos are caption-disabled by creator
3. Alternative: Download transcript separately, use `add_text_source`

### Google Drive source fails
**Symptom:** `add_drive_source` returns permission error.

**Cause:** File not shared with the authenticated account.

**Fix:**
1. Verify Drive file is shared with your Google account
2. Ensure file ID is correct (from `/file/d/{ID}/` in URL)
3. Try sharing file with "Anyone with link" first

### Source appears in list but Q&A doesn't use it
**Symptom:** `list_sources` shows source, but `ask_question` doesn't reference it.

**Cause:** Source may still be indexing (takes 30 seconds to 2 minutes).

**Fix:**
1. Wait 1-2 minutes after adding source
2. Use `summarize_source` to verify content is parsed
3. Ask a question that should match the source content
4. If still not working, delete and re-add source

---

## Research Workflow Troubleshooting

### Session loses context between questions
**Symptom:** Second `ask_question` with `session_id` doesn't remember first question.

**Cause:** Session ID not correctly reused.

**Fix:**
```javascript
// Correct way
response1 = ask_question({ question: "Q1", notebook_id: "abc" })
session_id = response1.session_id  // Capture from response

// Then reuse
response2 = ask_question({ question: "Q2", session_id: session_id })
```

### Research timeout
**Symptom:** `ask_question` hangs or times out.

**Cause:** Browser timeout (default 30s) or slow NotebookLM response.

**Fix:**
1. Increase timeout: `browser_options: { timeout_ms: 60000 }`
2. Try simpler question first
3. Check internet connection
4. If notebook is very large, it may need more time

### Notebook context seems wrong
**Symptom:** Answers reference wrong notebook even with `notebook_id` specified.

**Cause:** Active notebook not updated or tool parameter ignored.

**Fix:**
1. Explicitly pass `notebook_id` parameter
2. Verify with `list_notebooks` which is active
3. Use `select_notebook` to set active, then ask question

---

## Browser & Profile Troubleshooting

### "Profile already in use" errors
**Symptom:** `ProcessSingleton` or profile lock error.

**Cause:** Multiple instances competing for same Chrome profile.

**Fix:**
1. Check: `list_sessions` (how many active?)
2. Close unnecessary: `close_session`
3. If all closed but error persists:
   - Close all Chrome windows on system
   - Run `cleanup_data` with `confirm: true`
   - Re-authenticate with `setup_auth`

### Browser crashes or becomes unresponsive
**Symptom:** Browser window freezes or crashes during operation.

**Cause:** Browser context corrupted or system resource exhausted.

**Fix:**
1. Close affected session: `close_session`
2. List remaining sessions: `list_sessions`
3. Check system memory/CPU
4. If frequent, run: `cleanup_data` → `setup_auth`

---

## Session Management Improvements (v2.1.0+)

### Session mutex lock
Concurrent session creation now uses mutex lock to prevent race conditions. Sessions are safe for parallel requests.

### Heartbeat during operations
Sessions receive heartbeat updates during long operations. Eviction is based on `lastActivity`, not `createdAt`, so active operations won't trigger premature cleanup.

### Input validation & security
All MCP tool arguments are validated before execution. Type mismatches and security issues are caught early.

### TOCTOU protection
State file access uses atomic operations and file locking to prevent time-of-check-time-of-use attacks.

---

## Notebook Creation Issues (v2.2.0 Known Issue)

### create_notebook_remote fails with "no ID returned"
**Symptom:** `create_notebook_remote` returns error: "Failed to create notebook - no ID returned".

**Root cause:** Authentication OK, RPC call (CCqFvf) executes successfully, but response parser cannot extract notebook ID. Likely Google changed response format for RPC ID CCqFvf.

**Workaround:** Create notebook manually on https://notebooklm.google.com, then use `add_notebook` to add it to your library.

**Status:** Investigating response format change for notebook creation RPC in v2.2.0.

---

## Streaming Chat (Experimental in v2.2.0)

**Note:** Streaming chat client is experimental in v2.2.0. Browser-based Q&A remains stable and always available as fallback.

**Benefits when available:**
- Lower latency (2-4s vs 8-15s)
- Less memory overhead
- Direct gRPC-Web streaming
