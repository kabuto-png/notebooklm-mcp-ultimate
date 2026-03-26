# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it through [GitHub Security Advisories](https://github.com/kabuto-png/notebooklm-mcp-ultimate/security/advisories/new) (private reporting).

**Do not** open a public issue for security vulnerabilities.

## Response Timeline

- **Acknowledgement:** within 48 hours
- **Fix target:** within 30 days of confirmed vulnerability
- **Disclosure:** coordinated disclosure after the fix is released

## Scope

The following areas are in scope for security reports:

- MCP server code and tool handlers
- Authentication flow (cookie management, CSRF tokens)
- Browser automation layer (Patchright integration)
- Session management and data storage

## Important Notes

This project handles Google authentication cookies and browser state. Users should:

- **Never** share `browser_state/` or `chrome_profile/` directories
- **Never** commit `.env` files containing credentials
- Use the `AUTO_LOGIN_*` environment variables responsibly
- Review `.env.example` for security-sensitive configuration options

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x     | Yes       |
| < 2.0   | No        |
