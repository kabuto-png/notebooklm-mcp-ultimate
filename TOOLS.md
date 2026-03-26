## Tools Overview

All 44 MCP tools organized across 9 categories. Use the **Session Flow** in `ask_question` documentation for best practices on multi-step research.

---

## 1. System Management (4 tools)

### get_health
**Check server status, authentication state, and active sessions**

Verify NotebookLM is connected, authentication is valid, and browser sessions are running.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| None | - | - | No parameters required |

**Returns:** `authenticated` (boolean), active session count, configuration state.

### setup_auth
**Manual Google Authentication**

Open browser for first-time login or to re-establish authentication.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `show_browser` | boolean | No | Show browser window (default: true) |
| `browser_options` | object | No | Advanced browser control |

**When to use:**
- First time setup
- After cleaning auth data
- When you see "not authenticated" errors

### re_auth
**Switch Google accounts or reset authentication**

Clears all auth data and opens browser for fresh login with a different account.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `show_browser` | boolean | No | Show browser window (default: true) |
| `browser_options` | object | No | Advanced browser control |

**When to use:**
- Hit NotebookLM’s 50 queries/day free tier limit
- Switch to Google AI Pro account for higher limits
- Completely reset authentication

### cleanup_data
**Deep cleanup of all NotebookLM MCP data**

Remove browser profiles, caches, logs, and temporary files. Optionally preserve notebook library.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `confirm` | boolean | Yes | Explicit confirmation (shows preview first) |
| `preserve_library` | boolean | No | Keep library.json while cleaning everything else (default: false) |

**Before running:**
- Close ALL Chrome/Chromium instances
- Backup library.json if not using preserve option

**Cleans:** Browser data, caches, old installations, logs. Preserves: library metadata (if enabled).

---

## 2. Session Management (3 tools)

### list_sessions
**View all active browser sessions**

See currently open NotebookLM research sessions with metadata.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| None | - | - | No parameters required |

**Returns:** Session IDs, age (seconds), message count, last activity time.

### close_session
**Terminate specific session**

Close a browser context to free resources.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `session_id` | string | Yes | Session ID to close |

**Returns:** Confirmation of session closure.

**Tip:** Ask before closing—confirm with user that they don’t need the session context.

### reset_session
**Clear session history and context**

Keep same session ID but erase chat history (useful when switching notebooks/topics in same session).

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `session_id` | string | Yes | Session ID to reset |

**Returns:** Confirmation that chat history is cleared; same session_id ready for reuse.

---

## 3. Notebook Management (8 tools)

### add_notebook
**Add notebook to library**

Add a NotebookLM notebook with metadata (conversational, expects confirmation).

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `url` | string | Yes | NotebookLM notebook share link |
| `name` | string | Yes | Display name |
| `description` | string | Yes | What’s in this notebook |
| `topics` | array | Yes | List of topics covered |
| `use_cases` | array | No | When to use this notebook |
| `tags` | array | No | Organization tags |
| `content_types` | array | No | Content type labels |

**Returns:** Confirmation with notebook ID and metadata.

### list_notebooks
**View all notebooks in library**

Return complete metadata for every notebook.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| None | - | - | No parameters required |

**Returns:** Array with id, name, description, topics, tags, active status, URL.

### get_notebook
**Fetch single notebook metadata**

Get full details about a specific notebook.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | string | Yes | Notebook ID |

**Returns:** Complete notebook metadata including description, topics, use cases, URL.

### select_notebook
**Set active default notebook**

Change which notebook is used by default for `ask_question` and content generation.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | string | Yes | Notebook ID to activate |

**Returns:** Confirmation with new active notebook name.

### update_notebook
**Modify notebook metadata**

Change name, description, topics, tags, or other fields.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | string | Yes | Notebook ID |
| `name` | string | No | New display name |
| `description` | string | No | New description |
| `topics` | array | No | Updated topic list |
| `use_cases` | array | No | Updated use cases |
| `tags` | array | No | Updated tags |
| `url` | string | No | Update notebook URL |
| `content_types` | array | No | Updated content type labels |

**Returns:** Confirmation with updated metadata.

### remove_notebook
**Remove notebook from library**

Delete library entry (does NOT delete the actual NotebookLM notebook—only removes from your library).

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | string | Yes | Notebook ID |

**Returns:** Confirmation of removal.

**Important:** This is non-destructive—you can re-add the notebook later using its share link.

### search_notebooks
**Query library**

Find notebooks by name, description, topics, or tags.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `query` | string | Yes | Search term (matches name/description/topics/tags) |

**Returns:** Matching notebooks with metadata.

### get_library_stats
**Notebook library statistics**

Returns aggregate counts and usage metrics for your library.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| None | - | - | No parameters required |

**Returns:** Total notebooks, active notebook, topics count, creation dates.

---

## 4. Notebook CRUD - Remote API (4 tools)

These tools operate directly on NotebookLM servers (API + browser automation for file upload).

### create_notebook_remote
**Create a new notebook in NotebookLM**

Creates an empty notebook directly in your NotebookLM account.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `title` | string | No | Notebook name (defaults to "Untitled notebook") |

**Returns:** `notebook_id`, `title`, `url` for the new notebook.

**After creating:** Use `add_url_source`, `add_text_source`, etc. to add content.

### rename_notebook_remote
**Rename a notebook in NotebookLM**

Change the title of an existing notebook directly on NotebookLM servers.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | Yes | UUID of notebook to rename |
| `new_title` | string | Yes | New name for the notebook |

**Returns:** Confirmation with updated title.

**Note:** Different from `update_notebook` which only changes local library metadata.

### delete_notebook_remote
**DANGEROUS: Permanently delete notebook from NotebookLM**

Removes notebook and ALL sources permanently. Cannot be undone.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | Yes | UUID of notebook to delete |

**Returns:** Confirmation of permanent deletion.

**Warning:** Always confirm with user before calling. This deletes from NotebookLM servers.

### add_file_source
**Upload local file as notebook source**

Upload PDF, docs, images, or audio files via browser automation.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | Yes | UUID of target notebook |
| `file_path` | string | Yes | Absolute path to file on disk |

**Returns:** Confirmation with uploaded file name.

**Supported:** PDF, docx, txt, images, audio. Large files may take longer.

---

## 5. Content Generation (9 tools)

### generate_faq
**Create FAQ from notebook sources**

Build frequently asked questions and answers from document content.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook (uses active if omitted) |
| `source_ids` | array | No | Specific sources (uses all if omitted) |

**Returns:** Markdown list of Q&A pairs extracted from content.

### generate_briefing
**Create executive summary**

Concise overview with key points and takeaways.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `source_ids` | array | No | Specific sources |

**Returns:** Structured briefing with highlights and action items.

### generate_timeline
**Extract chronological events**

Order dates, milestones, and events mentioned in sources.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `source_ids` | array | No | Specific sources |

**Returns:** Markdown timeline with dates and event descriptions.

### generate_outline
**Hierarchical structure**

Create organized outline of topics and subtopics.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `source_ids` | array | No | Specific sources |

**Returns:** Nested markdown outline showing content structure.

### generate_study_guide
**Comprehensive learning material**

Key concepts, definitions, and review materials.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `source_ids` | array | No | Specific sources |

**Returns:** Study guide with concepts, definitions, and practice questions.

### generate_flashcards
**Question/answer pairs**

Create flashcard-style content for memorization.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `source_ids` | array | No | Specific sources |

**Returns:** Array of Q&A flashcard objects.

### generate_quiz
**Test comprehension**

Questions to test understanding of material.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `source_ids` | array | No | Specific sources |

**Returns:** Quiz with questions, options, and answer keys.

### generate_mindmap
**Concept relationships**

Visual representation of how concepts connect.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `source_ids` | array | No | Specific sources |

**Returns:** Mind map structure showing concept hierarchy and connections.

### suggest_questions
**Suggested questions for active notebook**

Get question ideas based on notebook content.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook (uses active if omitted) |

**Returns:** List of relevant research questions to ask about notebook sources.

---

## 6. Audio Studio (5 tools)

### get_audio_status
**Check audio generation status**

See if audio overview exists and whether generation is in progress.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |

**Returns:** Status (exists, generating, ready), progress percentage.

### create_audio
**Generate podcast-style overview**

Create audio summary with two AI hosts discussing notebook content.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `target_audience` | string | No | "general" \| "expert" \| "student" (default: general) |
| `focus_topics` | array | No | Specific topics to emphasize |
| `custom_instructions` | string | No | Instructions for audio style |
| `wait_for_completion` | boolean | No | Wait for generation (default: false) |

**Returns:** Confirmation that audio generation started. Generation takes few minutes.

### update_audio
**Regenerate with new instructions**

Replace existing audio with new generation using different parameters.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `target_audience` | string | No | New audience level |
| `focus_topics` | array | No | New topic focus |
| `custom_instructions` | string | No | New instructions |

**Returns:** Confirmation that regeneration started.

### delete_audio
**Remove audio overview**

Permanently delete generated audio.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |

**Returns:** Confirmation of deletion.

### download_audio
**Get playable audio URL**

Retrieve temporary download/stream URL for audio.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |

**Returns:** Temporary URL for audio playback/download (expires after time).

---

## 7. Source Management (7 tools)

### list_sources
**View all sources in notebook**

Get metadata for every source (document, video, text, etc.).

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook (uses active if omitted) |

**Returns:** Array with source ID, title, type (URL/text/YouTube/Drive), creation date, status.

### add_url_source
**Import webpage**

Add URL (webpage, PDF, article) as source.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `url` | string | Yes | Publicly accessible URL |

**Returns:** Source ID and metadata.

**Supported:** Web pages, PDFs, text files, documentation sites.

### add_text_source
**Add text content**

Paste notes, transcripts, or custom text.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `title` | string | Yes | Source title (e.g., "Meeting Notes") |
| `content` | string | Yes | Text content |

**Returns:** Source ID and metadata.

### add_youtube_source
**Import video transcript**

Extract and add YouTube video transcript as source.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `youtube_url` | string | Yes | YouTube video URL |

**Returns:** Source ID and transcript metadata.

**Requirements:** Video must have captions/subtitles.

### add_drive_source
**Import Google Drive file**

Add Google Docs, Sheets, Slides, or PDFs from Drive.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `file_id` | string | Yes | Google Drive file ID |

**Returns:** Source ID and metadata.

**File ID location:** In Drive URL: `/file/d/{FILE_ID}/`

### delete_source
**Remove source from notebook**

Remove source and make it unavailable for Q&A and content generation.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `source_id` | string | Yes | Source ID (from list_sources) |

**Returns:** Confirmation of deletion.

### summarize_source
**Get source summary**

Quick overview of a single source’s content and metadata.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `source_id` | string | Yes | Source ID |

**Returns:** Title, type, creation date, basic content summary, status.

---

## 8. Q&A (1 tool)

### ask_question
**Conversational Research with Gemini 2.5 and Session RAG**

Research topics with persistent context across multiple questions in the same session.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `question` | string | Yes | Question to ask NotebookLM |
| `session_id` | string | No | Reuse existing session for context continuity |
| `notebook_id` | string | No | Specific notebook to query (uses active if omitted) |
| `notebook_url` | string | No | Ad-hoc notebook URL (alternative to library notebooks) |
| `show_browser` | boolean | No | Display browser window during research |
| `browser_options` | object | No | Advanced: headless, timeout_ms, stealth, viewport settings |

**Returns:** Answer grounded in notebook sources + reminder to ask follow-ups for deeper coverage.

**Best practice:** Save `session_id` from first response; reuse it for follow-up questions in same session.

---

## 9. Research (3 tools)

### discover_sources
**Find sources for topic**

Get search query suggestions and source type recommendations for research.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `topic` | string | Yes | Research topic |

**Returns:** Suggested queries, recommended source types, tips for finding quality sources.

### import_source
**Add source by URL**

Smart import that validates URL and adds as source (supports web pages, YouTube, Google Drive, academic papers, GitHub).

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `url` | string | Yes | Source URL |

**Returns:** Source ID and metadata.

**Supported types:** Web, YouTube, Google Drive, arXiv, GitHub repos.

### research_topic
**Research workflow with optional auto-import**

Generate search queries, suggest source types, optionally auto-import starter sources.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `notebook_id` | string | No | Specific notebook |
| `topic` | string | Yes | Research topic |
| `auto_import` | boolean | No | Auto-import starter sources like Wikipedia (default: false) |

**Returns:** Search suggestions, source type recommendations, optionally imports sources.

---

## MCP Resources

### notebooklm://library
**Full library JSON**

Access complete library data: active notebook, statistics, all notebook metadata.

### notebooklm://library/{id}
**Single notebook metadata**

Get metadata for specific notebook by ID. ID completion is auto-populated from library.

---

## Session Flow (Best Practice)

```javascript
// 1) Start broad - creates new session
ask_question({ question: "Give me an overview of [topic]" })
// Returns: session_id in response

// 2) Go specific - reuse session_id
ask_question({ question: "What are the key APIs?", session_id })

// 3) Cover pitfalls - same session
ask_question({ question: "Common edge cases?", session_id })

// 4) Production example - finalize
ask_question({ question: "Show production-ready example", session_id })
```

Each response includes a reminder: keep asking follow-up questions until you have complete understanding.
