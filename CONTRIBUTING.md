# Contributing to NotebookLM MCP Ultimate

Thank you for your interest in contributing. [Open an issue](https://github.com/kabuto-png/notebooklm-mcp-ultimate/issues) to report bugs, request features, or discuss ideas before submitting a PR.

---

## Development Setup

```bash
git clone https://github.com/kabuto-png/notebooklm-mcp-ultimate.git
cd notebooklm-mcp-ultimate
npm install
npm run build
npm run dev    # watch mode
```

Node.js >= 18 is required.

---

## Project Structure

```
src/
├── index.ts          # Entry point — MCP server bootstrap
├── tools/            # Tool definitions and request handlers
├── auth/             # Authentication manager (cookies, CSRF, sessions)
├── browser/          # Patchright browser automation layer
└── utils/            # Shared utilities (logging, config, helpers)
```

---

## Making Changes

1. Branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Make your changes and verify the build passes:
   ```bash
   npm run build
   ```
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add summarize_notebook tool
   fix: handle expired CSRF token on retry
   docs: update tool reference for audio studio
   ```
4. Open a pull request against `main` with a clear description of what changed and why.

---

## Code Standards

- TypeScript with strict mode enabled — all code must compile without errors.
- There is no automated test suite yet; the build must pass cleanly (`npm run build`).
- Keep individual files under ~200 lines; split logic into focused modules.
- Follow patterns already established in `src/tools/` and `src/auth/`.
- No `console.log` in production paths — use the shared logger in `src/utils/`.

---

## PR Checklist

Before submitting your pull request, confirm:

- [ ] `npm run build` completes with no errors
- [ ] No secrets, credentials, cookies, or browser state files are committed
- [ ] Commit messages follow the Conventional Commits format
- [ ] The PR description explains the motivation and summarises the changes
- [ ] If you added a new tool, it is listed/documented appropriately
