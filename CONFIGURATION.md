## Configuration

**No config files needed!** The server works out of the box with sensible defaults.

### Configuration Priority (highest to lowest):
1. **Tool Parameters** - Claude passes settings like `browser_options` at runtime
2. **Environment Variables** - Optional overrides for advanced users
3. **Hardcoded Defaults** - Sensible defaults that work for most users

### Development Scripts

```bash
npm run lint       # ESLint (flat config v9+): check TS/JS code
npm run typecheck  # TypeScript: verify type safety
npm run build      # Compile TypeScript to dist/
npm run test       # No-op placeholder
npm run dev        # Development mode with auto-reload
```

See `.env.example` for all 30+ configurable environment variables.

---

## Tool Parameters (Runtime Configuration)

### Browser Behavior (`ask_question`, `setup_auth`, `re_auth`)

```typescript
browser_options: {
  show: boolean,              // Show browser window (overrides headless)
  headless: boolean,          // Run in headless mode (default: true)
  timeout_ms: number,         // Browser timeout in ms (default: 30000)

  stealth: {
    enabled: boolean,         // Master switch (default: true)
    random_delays: boolean,   // Random delays between actions (default: true)
    human_typing: boolean,    // Human-like typing (default: true)
    mouse_movements: boolean, // Realistic mouse movements (default: true)
    typing_wpm_min: number,   // Min typing speed (default: 160)
    typing_wpm_max: number,   // Max typing speed (default: 240)
    delay_min_ms: number,     // Min delay between actions (default: 100)
    delay_max_ms: number,     // Max delay between actions (default: 400)
  },

  viewport: {
    width: number,            // Viewport width (default: 1024)
    height: number,           // Viewport height (default: 768)
  }
}
```

**Common patterns:**
```
"Research this and show me the browser"
  → { show: true }

"Speed up this query"
  → { stealth: { typing_wpm_min: 300, typing_wpm_max: 400 } }

"Use slower, more human-like behavior"
  → { stealth: { human_typing: true, random_delays: true } }
```

### Content Generation Tool Parameters

Tools like `generate_faq`, `generate_briefing`, etc. accept:
- `notebook_id` - Target specific notebook
- `source_ids` - Limit to specific sources (optional)

Example:
```typescript
generate_study_guide({
  notebook_id: "abc123",
  source_ids: ["src1", "src2"]  // Only use these sources
})
```

### Audio Studio Parameters

`create_audio` and `update_audio` accept:
- `target_audience` - "general" | "expert" | "student"
- `focus_topics` - Array of topic strings to emphasize
- `custom_instructions` - String with tone/style preferences
- `wait_for_completion` - Boolean (default: false)

Example:
```typescript
create_audio({
  notebook_id: "docs123",
  target_audience: "expert",
  focus_topics: ["authentication", "error handling"],
  custom_instructions: "Use technical terminology, assume NodeJS experience"
})
```

---

## Environment Variables (Optional)

See `.env.example` in repository root for complete template with all 30+ variables.

For advanced users who want to set global defaults:
- Auth
  - `AUTO_LOGIN_ENABLED` — `true|false` (default `false`)
  - `LOGIN_EMAIL`, `LOGIN_PASSWORD` — for auto‑login if enabled
  - `AUTO_LOGIN_TIMEOUT_MS` (default `120000`)
- Stealth / Human-like behavior
  - `STEALTH_ENABLED` — `true|false` (default `true`) — Master switch for all stealth features
  - `STEALTH_RANDOM_DELAYS` — `true|false` (default `true`)
  - `STEALTH_HUMAN_TYPING` — `true|false` (default `true`)
  - `STEALTH_MOUSE_MOVEMENTS` — `true|false` (default `true`)
- Typing speed (human‑like)
  - `TYPING_WPM_MIN` (default 160), `TYPING_WPM_MAX` (default 240)
- Delays (human‑like)
  - `MIN_DELAY_MS` (default 100), `MAX_DELAY_MS` (default 400)
- Browser
  - `HEADLESS` (default `true`), `BROWSER_TIMEOUT` (ms, default `30000`)
- Sessions
  - `MAX_SESSIONS` (default 10), `SESSION_TIMEOUT` (s, default 900)
- Multi‑instance profile strategy
  - `NOTEBOOK_PROFILE_STRATEGY` — `auto|single|isolated` (default `auto`)
  - `NOTEBOOK_CLONE_PROFILE` — clone base profile into isolated dir (default `false`)
- Cleanup (to prevent disk bloat)
  - `NOTEBOOK_CLEANUP_ON_STARTUP` (default `true`)
  - `NOTEBOOK_CLEANUP_ON_SHUTDOWN` (default `true`)
  - `NOTEBOOK_INSTANCE_TTL_HOURS` (default `72`)
  - `NOTEBOOK_INSTANCE_MAX_COUNT` (default `20`)
- Library metadata (optional hints)
  - `NOTEBOOK_DESCRIPTION`, `NOTEBOOK_TOPICS`, `NOTEBOOK_CONTENT_TYPES`, `NOTEBOOK_USE_CASES`
  - `NOTEBOOK_URL` — optional; leave empty and manage notebooks via the library
- Content generation polling
  - `OPERATION_POLL_INTERVAL_MS` (default: 2000) - Polling interval
  - `OPERATION_POLL_TIMEOUT_MS` (default: 300000) - Max poll time (5 min)

---

## Storage Paths

The server uses platform-specific paths via [env-paths](https://github.com/sindresorhus/env-paths)
- **Linux**: `~/.local/share/notebooklm-mcp/`
- **macOS**: `~/Library/Application Support/notebooklm-mcp/`
- **Windows**: `%LOCALAPPDATA%\notebooklm-mcp\`

**What's stored:**
- `chrome_profile/` - Persistent Chrome browser profile with login session
- `browser_state/` - Browser context state and cookies
- `library.json` - Your notebook library with metadata
- `chrome_profile_instances/` - Isolated Chrome profiles for concurrent sessions

**No config.json file** - Configuration is purely via environment variables or tool parameters!

