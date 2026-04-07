#!/bin/bash
# NotebookLM Cookie Sync
# Usage:
#   Interactive: nlm-cookie-sync.sh
#   With args:   nlm-cookie-sync.sh -f cookies.json [-r user@host]
#   Help:        nlm-cookie-sync.sh -h

LOCAL_PATH="$HOME/.local/share/notebooklm-mcp/browser_state/state.json"

show_help() {
    echo "Usage: nlm-cookie-sync.sh [-f file] [-r remote] [-h]"
    echo "  -f  Cookies JSON file from browser extension"
    echo "  -r  SSH target (empty = local)"
    echo "  -h  Show help"
    echo ""
    echo "Examples:"
    echo "  ./nlm-cookie-sync.sh                      # Interactive"
    echo "  ./nlm-cookie-sync.sh -f cookies.json      # Local"
    echo "  ./nlm-cookie-sync.sh -f cookies.json -r pi # Remote"
}

COOKIES_FILE=""
REMOTE=""

while getopts "f:r:h" opt; do
    case $opt in
        f) COOKIES_FILE="$OPTARG" ;;
        r) REMOTE="$OPTARG" ;;
        h) show_help; exit 0 ;;
        *) show_help; exit 1 ;;
    esac
done

# Interactive mode if no cookies file arg
if [ -z "$COOKIES_FILE" ]; then
    echo "=== NotebookLM Cookie Sync ==="
    echo "[1/2] Paste cookies JSON, then press Ctrl+D:"
    cat > /tmp/nlm_cookies_raw.json
    COOKIES_FILE="/tmp/nlm_cookies_raw.json"
    echo ""
    echo "[2/2] SSH target (empty = local):"
    read -r REMOTE
fi

# Sanitize: remove control chars except newline/tab
tr -d '\000-\010\013\014\016-\037' < "$COOKIES_FILE" > /tmp/nlm_cookies_clean.json

# Convert cookies using file input
python3 -c "
import json, sys, re
try:
    with open('/tmp/nlm_cookies_clean.json', 'r') as f:
        content = f.read().strip()
    # Remove any remaining problematic chars
    content = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', content)
    raw = json.loads(content)
    sm = {'unspecified':'Lax','lax':'Lax','strict':'Strict','no_restriction':'None'}
    out = [{'name':c['name'],'value':c['value'],'domain':c['domain'],'path':c['path'],
            'expires':c.get('expirationDate',-1),'httpOnly':c['httpOnly'],
            'secure':c['secure'],'sameSite':sm.get(c.get('sameSite','unspecified'),'Lax')} for c in raw]
    with open('/tmp/nlm_state.json', 'w') as f:
        json.dump({'cookies':out}, f)
    print(f'Converted {len(out)} cookies')
except Exception as e:
    print(f'Error: {e}', file=sys.stderr); sys.exit(1)
"

if [ $? -ne 0 ]; then echo "Failed to convert cookies"; exit 1; fi

if [ -z "$REMOTE" ]; then
    mkdir -p "$(dirname $LOCAL_PATH)"
    cp /tmp/nlm_state.json "$LOCAL_PATH"
    echo "Applied locally: $LOCAL_PATH"
else
    ssh "$REMOTE" "mkdir -p ~/.local/share/notebooklm-mcp/browser_state"
    scp /tmp/nlm_state.json "$REMOTE:~/.local/share/notebooklm-mcp/browser_state/state.json"
    echo "Uploaded to: $REMOTE"
fi
echo "Done!"
