# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.1] - 2026-03-26

### Added

- **Chrome Profile Dir Config** — New `NOTEBOOK_CHROME_PROFILE_DIR` env var to specify custom Chromium profile path
- **Community Docs** — CONTRIBUTING.md, CODE_OF_CONDUCT.md (Contributor Covenant v2.1), SECURITY.md (GitHub Security Advisories)
- **GitHub Templates** — Bug report and feature request issue forms (YAML), PR template with checklist
- **CI/CD** — GitHub Actions workflow: build + lint + typecheck across Node 18/20/22
- **ESLint** — Minimal TypeScript config (flat config, ESLint v9+), errors-only — no style enforcement
- **Developer Scripts** — `npm run lint`, `npm run typecheck`; fixed `test` script to no-op placeholder
- **.env.example** — Documents all 30+ environment variables with descriptions and defaults
- **CI Badge** — Added to README alongside existing badges

### Fixed

- **Content Generation** — Fire-and-forget pattern for content gen tools; triggers R7cb6c and returns immediately without polling (avoids timeout on slow generations)
- **Content Generation Wiring** — Content gen tools now properly use async poller; removed leftover debug logging
- **Authentication** — Filter cookies to `.google.com` domain only, fixing 401 errors caused by unrelated cookies leaking into API requests
- **Response Parser** — Fix `processResponseChunk` to handle single-wrapped arrays (Google sometimes returns `[item]` instead of `[[item]]`)
- **Response Parser** — Fix batchexecute response parsing when length indicators are unreliable; fall back to line-by-line JSON parsing
- **Package Metadata** — Removed non-existent `NOTEBOOKLM_USAGE.md` and gitignored `docs/` from npm `files` field
- **Lint Errors** — Fixed 14 lint issues across 5 files (unused vars, no-case-declarations, require→import)
- **.gitignore** — Added browser cache, tgz artifacts, test result patterns

### Changed

- **README** — Added Contributing, Security, and Code of Conduct sections
- **npm scripts** — Removed redundant `watch` (use `dev` instead)

---

## [2.2.0] - 2026-03-21

### Added - API Enhancements

- **Unified Content Generation** — All content types now use single `R7cb6c` RPC with `ContentTypeCode` enum (1-10)
  - New content types: Infographic (9), Data Table (10)
  - `content-types.ts` — Type codes, labels, and request builders
  - `operation-poller.ts` — Async polling for content generation (triggers R7cb6c, polls gArtLc until complete)
  - `generateAndWait()` convenience method on API client

- **Streaming Chat Client** (EXPERIMENTAL) — Direct gRPC-Web Q&A without browser automation
  - `streaming-chat-client.ts` — Proto-encoded requests to GenerateFreeFormStreamed endpoint
  - `streamChat()` async generator yields text fragments as they arrive
  - `collectStreamChat()` convenience wrapper returns full response

- **Batch Convenience Methods** on `NotebookLMAPIClient`
  - `createNotebookWithSource()` — Create notebook + add text source in one call
  - `batchListNotebooksAndSources()` — Parallel fetch of notebooks and sources
  - `generateAndWait()` — Trigger content gen + poll until ready

- **RPC ID Discovery Script** — `scripts/discover-rpc-ids.ts` for capturing live RPC IDs via Playwright

- **NotebookLM Integration Guides**
  - `docs/cowork/research-before-code.md` — Query notebook before implementing
  - `docs/cowork/notebook-sync.md` — Sync doc changes to notebooks
  - `docs/cowork/debug-with-notebook.md` — Debug with notebook knowledge base
  - `docs/notebooklm/SKILL.md` — Project-specific question patterns

### Fixed - 42 Edge Cases

#### Security & Input Validation (Critical/High)
- Session creation mutex lock prevents concurrent race conditions
- `clearAllAuthData` documented: callers must close sessions first
- TOCTOU protection on auth state file access
- Runtime `validateArgs` for 9 critical MCP tool handlers
- URL validation on `addNotebook` (must start with http)
- Empty ID fallback in `generateId` (timestamp-based)

#### Session Management
- Eviction now by `lastActivity` (not `createdAt`) — protects active sessions
- Heartbeat during `ask()` prevents mid-operation eviction
- `closeAllSessions` no longer restarts cleanup interval during shutdown
- Multi-locale browser selectors (not just German `aria-label`)
- WPM randomization fixed (`Math.max` → random between min/max)
- sessionStorage listener cleaned up after 30s timeout

#### API & Response Parsing
- CSRF fetch deduplication (prevents concurrent token fetches)
- Removed false-positive "401"/"429" substring checks
- `parseGeneratedContent` skips URLs and JSON strings
- `parseSourceItem` uses first type match only (not last)
- Duplicate RPC ID warning guard in `executeBatch`
- Auth validation before streaming chat (throws if no SAPISID)
- Stale artifact prevention via `createdAfter` timestamp tracking
- AbortSignal cancellation support in `pollOperation`
- Structured `StreamChatResult` return type with error info
- `createNotebookWithSource` returns structured result for partial failures
- Singleton API client warns when config is ignored

#### Library
- Concurrent write safety documented (sync operations = natural serialization)

### Changed

- **Version Unified** — Single `SERVER_VERSION` constant replaces 3 different version strings
- **Updated RPC IDs** — Many IDs refreshed to match current NotebookLM API
- **Tool Count** — 44 tools total
- **LOC** — ~18K (was ~15K)
- **Documentation** — All docs updated for v2.2.0

---

## [2.1.0] - 2026-03-07

### Added - 4 New Notebook CRUD Tools

#### Notebook Management Tools (4 tools)
- `create_notebook_remote` - Create new notebook via NotebookLM API (no browser required)
- `rename_notebook_remote` - Rename existing notebook via API
- `delete_notebook_remote` - Delete notebook permanently via API
- `add_file_source` - Upload local file as source via browser automation

### Added - Documentation & Reference

- **UI Selectors Reference** (`notebooklm-ui-selectors.json`) - Comprehensive UI element mappings for browser automation
- **System Architecture** (`docs/system-architecture.md`) - Technical architecture documentation
- **Codebase Summary** (`docs/codebase-summary.md`) - High-level codebase overview

### Technical Details

**New Files:**
- `src/operations/notebook-crud-operations.ts` - Notebook CRUD business logic
- `src/tools/definitions/notebook-crud.ts` - 4 notebook tool definitions
- `src/tools/handlers/notebook-crud-handlers.ts` - CRUD handlers
- `notebooklm-ui-selectors.json` - UI selector documentation

**Implementation Notes:**
- API-first approach for create/rename/delete (faster, no browser needed)
- Browser automation for file upload (no API exists)
- Uses `setInputFiles()` for headless file uploads

**Tool Count:** 40 → 44 tools

---

## [2.0.0] - 2026-01-27

### Added - 24 New Advanced Tools

#### Content Generation Tools (9 tools)
- `generate_faq` - Generate FAQ from notebook sources with Q&A pairs
- `generate_briefing` - Create executive briefing document
- `generate_timeline` - Extract timeline of events from sources
- `generate_outline` - Create structured outline with hierarchical organization
- `generate_study_guide` - Generate comprehensive study materials
- `generate_flashcards` - Create flashcard sets for learning and memorization
- `generate_quiz` - Generate quiz questions with answers and explanations
- `generate_mindmap` - Create mind map structure for visual learning
- `suggest_questions` - Get AI-suggested follow-up questions for deeper research

#### Audio Studio Tools (5 tools)
- `get_audio_status` - Check audio overview generation status and progress
- `create_audio` - Generate audio overview (podcast-style) from notebook
- `update_audio` - Modify audio generation settings and regenerate
- `delete_audio` - Remove audio overview from notebook
- `download_audio` - Get audio download URL for offline listening

#### Source Management Tools (7 tools)
- `list_sources` - List all sources in a notebook with metadata
- `add_url_source` - Add URL as source (websites, articles, documentation)
- `add_text_source` - Add text/paste content directly as source
- `add_youtube_source` - Add YouTube video as source with transcript
- `add_drive_source` - Add Google Drive file as source
- `delete_source` - Remove a source from notebook
- `summarize_source` - Get source metadata and summary information

#### Research Tools (3 tools)
- `discover_sources` - Generate search query suggestions for research topics
- `import_source` - Import and validate URL sources with domain checking
- `research_topic` - Combined research workflow (discover + auto-import)

### Added - Infrastructure Improvements

- **Hybrid Executor** - API-first execution with browser fallback
  - Automatic retry logic with exponential backoff
  - Graceful degradation when API fails
  - Improved reliability for all operations
  - Configurable timeout and retry settings

- **Enhanced API Client** - Comprehensive NotebookLM API integration
  - Batch execute client for all API operations
  - CSRF token management
  - Request/response parsing
  - Type-safe API interactions

- **Modular Operations Architecture**
  - Separated business logic into dedicated operation modules
  - Clean separation: operations → handlers → tools
  - Improved maintainability and testability

### Changed

- **Tool Count** - Expanded from 16 to 40 total tools
  - 16 core tools (existing)
  - 24 new advanced tools (new in v2.0.0)

- **Tool Profiles Updated**
  - `full` profile now includes all 40 tools
  - Better categorization of tools by functionality
  - Improved tool descriptions and documentation

- **Package Description** - Updated to reflect new capabilities
  - Now: "MCP server for NotebookLM with 24 tools: Q&A, content generation, audio studio, source management, and research"

### Technical Details

**New Files:**
- `src/operations/content-operations.ts` - Content generation business logic
- `src/operations/studio-operations.ts` - Audio studio operations
- `src/operations/source-operations.ts` - Source management operations
- `src/operations/research-operations.ts` - Research and discovery operations
- `src/operations/hybrid-executor.ts` - Hybrid execution with fallback
- `src/tools/definitions/content-generation.ts` - 9 content tool definitions
- `src/tools/definitions/studio.ts` - 5 audio tool definitions
- `src/tools/definitions/source-management.ts` - 7 source tool definitions
- `src/tools/definitions/research.ts` - 3 research tool definitions
- `src/tools/handlers/content-handlers.ts` - Content generation handlers
- `src/tools/handlers/studio-handlers.ts` - Audio studio handlers
- `src/tools/handlers/source-handlers.ts` - Source management handlers
- `src/tools/handlers/research-handlers.ts` - Research handlers

**Build Status:** ✅ All tests passing, production ready

## [1.2.0] - 2025-11-21

### Added
- **Tool Profiles System** - Reduce token usage by loading only the tools you need
  - Three profiles: `minimal` (5 tools), `standard` (10 tools), `full` (16 tools)
  - Persistent configuration via `~/.config/notebooklm-mcp/settings.json`
  - Environment variable overrides: `NOTEBOOKLM_PROFILE`, `NOTEBOOKLM_DISABLED_TOOLS`

- **CLI Configuration Commands** - Easy profile management without editing files
  - `npx notebooklm-mcp config get` - Show current configuration
  - `npx notebooklm-mcp config set profile <name>` - Set profile (minimal/standard/full)
  - `npx notebooklm-mcp config set disabled-tools <list>` - Disable specific tools
  - `npx notebooklm-mcp config reset` - Reset to defaults

### Changed
- **Modularized Codebase** - Improved maintainability and code organization
  - Split monolithic `src/tools/index.ts` into `definitions.ts` and `handlers.ts`
  - Extracted resource handling into dedicated `ResourceHandlers` class
  - Cleaner separation of concerns throughout the codebase

### Fixed
- **LibreChat Compatibility** - Fixed "Server does not support completions" error
  - Added `prompts: {}` and `logging: {}` to server capabilities
  - Resolves GitHub Issue #3 for LibreChat integration

- **Thinking Message Detection** - Fixed incomplete answers showing placeholder text
  - Now waits for `div.thinking-message` element to disappear before reading answer
  - Removed unreliable text-based placeholder detection (`PLACEHOLDER_SNIPPETS`)
  - Answers like "Reviewing the content..." or "Looking for answers..." no longer returned prematurely
  - Works reliably across all languages and NotebookLM UI changes

## [1.1.2] - 2025-10-19

### Changed
- **README Documentation** - Added Claude Code Skill reference
  - New badge linking to [notebooklm-skill](https://github.com/PleasePrompto/notebooklm-skill) repository
  - Added prominent callout section explaining Claude Code Skill availability
  - Clarified differences between MCP server and Skill implementations
  - Added navigation link to Skill repository in top menu
  - Both implementations use the same browser automation technology

## [1.1.1] - 2025-10-18

### Fixed
- **Binary executable permissions** - Fixed "Permission denied" error when running via npx
  - Added `postbuild` script that automatically runs `chmod +x dist/index.js`
  - Ensures binary has executable permissions after compilation
  - Fixes installation issue where users couldn't run the MCP server

### Repository
- **Added package-lock.json** - Committed lockfile to repository for reproducible builds
  - Ensures consistent dependency versions across all environments
  - Improves contributor experience with identical development setup
  - Enables `npm ci` for faster, reliable installations in CI/CD
  - Follows npm best practices for library development (2025)

## [1.1.0] - 2025-10-18

### Added
- **Deep Cleanup Tool** - Comprehensive system cleanup for fresh NotebookLM MCP installations
  - Scans entire system for ALL NotebookLM files (installation data, caches, logs, temp files)
  - Finds hidden files in NPM cache, Claude CLI logs, editor logs, system trash, temp backups
  - Shows categorized preview before deletion with exact file list and sizes
  - Safe by design: Always requires explicit confirmation after preview
  - Cross-platform support: Linux, Windows, macOS
  - Enhanced legacy path detection for old config.json files
  - New dependency: globby@^14.0.0 for advanced file pattern matching
- CHANGELOG.md for version tracking
- Changelog badge and link in README.md

### Changed
- **Configuration System Simplified** - No config files needed anymore!
  - `config.json` completely removed - works out of the box with sensible defaults
  - Settings passed as tool parameters (`browser_options`) or environment variables
  - Claude can now control ALL browser settings via tool parameters
  - `saveUserConfig()` and `loadUserConfig()` functions removed
- **Unified Data Paths** - Consolidated from `notebooklm-mcp-nodejs` to `notebooklm-mcp`
  - Linux: `~/.local/share/notebooklm-mcp/` (was: `notebooklm-mcp-nodejs`)
  - macOS: `~/Library/Application Support/notebooklm-mcp/`
  - Windows: `%LOCALAPPDATA%\notebooklm-mcp\`
  - Old paths automatically detected by cleanup tool
- **Advanced Browser Options** - New `browser_options` parameter for browser-based tools
  - Control visibility, typing speed, stealth mode, timeouts, viewport size
  - Stealth settings: Random delays, human typing, mouse movements
  - Typing speed: Configurable WPM range (default: 160-240 WPM)
  - Delays: Configurable min/max delays (default: 100-400ms)
  - Viewport: Configurable size (default: 1024x768, changed from 1920x1080)
  - All settings optional with sensible defaults
- **Default Viewport Size** - Changed from 1920x1080 to 1024x768
  - More reasonable default for most use cases
  - Can be overridden via `browser_options.viewport` parameter
- Config directory (`~/.config/notebooklm-mcp/`) no longer created (not needed)
- Improved logging for sessionStorage (NotebookLM does not use sessionStorage)
- README.md updated to reflect config-less architecture

### Fixed
- **Critical: envPaths() default suffix bug** - `env-paths` library appends `-nodejs` suffix by default
  - All paths were incorrectly created with `-nodejs` suffix
  - Fix: Explicitly pass `{suffix: ""}` to disable default behavior
  - Affects: `config.ts` and `cleanup-manager.ts`
  - Result: Correct paths now used (`notebooklm-mcp` instead of `notebooklm-mcp-nodejs`)
- Enhanced cleanup tool to detect all legacy paths including manual installations
  - Added `getManualLegacyPaths()` method for comprehensive legacy file detection
  - Finds old config.json files across all platforms
  - Cross-platform legacy path detection (Linux XDG dirs, macOS Library, Windows AppData)
- **Library Preservation Option** - cleanup_data can now preserve library.json
  - New parameter: `preserve_library` (default: false)
  - When true: Deletes everything (browser data, caches, logs) EXCEPT library.json
  - Perfect for clean reinstalls without losing notebook configurations
- **Improved Auth Troubleshooting** - Better guidance for authentication issues
  - New `AuthenticationError` class with cleanup suggestions
  - Tool descriptions updated with troubleshooting workflows
  - `get_health` now returns `troubleshooting_tip` when not authenticated
  - Clear workflow: Close Chrome → cleanup_data(preserve_library=true) → setup_auth/re_auth
  - Critical warnings about closing Chrome instances before cleanup
- **Critical: Browser visibility (show_browser) not working** - Fixed headless mode switching
  - **Root cause**: `overrideHeadless` parameter was not passed from `handleAskQuestion` to `SessionManager`
  - **Impact**: `show_browser=true` and `browser_options.show=true` were ignored, browser stayed headless
  - **Solution**:
    - `handleAskQuestion` now calculates and passes `overrideHeadless` parameter correctly
    - `SharedContextManager.getOrCreateContext()` checks for headless mode changes before reusing context
    - `needsHeadlessModeChange()` now checks CONFIG.headless when no override parameter provided
  - **Session behavior**: When browser mode changes (headless ↔ visible):
    - Existing session is automatically closed and recreated with same session ID
    - Browser context is recreated with new visibility mode
    - Chat history is reset (message_count returns to 0)
    - This is necessary because NotebookLM chat state is not persistent across browser restarts
  - **Files changed**: `src/tools/index.ts`, `src/session/shared-context-manager.ts`

### Removed
- Empty postinstall scripts (cleaner codebase)
  - Deleted: `src/postinstall.ts`, `dist/postinstall.js`, type definitions
  - Removed: `postinstall` npm script from package.json
  - Follows DRY & KISS principles

## [1.0.5] - 2025-10-17

### Changed
- Documentation improvements
- Updated README installation instructions

## [1.0.4] - 2025-10-17

### Changed
- Enhanced usage examples in documentation
- Fixed formatting in usage guide

## [1.0.3] - 2025-10-16

### Changed
- Improved troubleshooting guide
- Added common issues and solutions

## [1.0.2] - 2025-10-16

### Fixed
- Fixed typos in documentation
- Clarified authentication flow

## [1.0.1] - 2025-10-16

### Changed
- Enhanced README with better examples
- Added more detailed setup instructions

## [1.0.0] - 2025-10-16

### Added
- Initial release
- NotebookLM integration via Model Context Protocol (MCP)
- Session-based conversations with Gemini 2.5
- Source-grounded answers from notebook documents
- Notebook library management system
- Google authentication with persistent browser sessions
- 16 MCP tools for comprehensive NotebookLM interaction
- Support for Claude Code, Codex, Cursor, and other MCP clients
- TypeScript implementation with full type safety
- Playwright browser automation with stealth mode