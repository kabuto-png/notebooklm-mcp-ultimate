const DOMAINS = ['.google.com', 'notebooklm.google.com', '.notebooklm.google.com'];

async function extractCookies() {
  const all = [];
  for (const domain of DOMAINS) {
    const cookies = await chrome.cookies.getAll({ domain });
    all.push(...cookies);
  }
  // Dedupe by name+domain
  const seen = new Set();
  return all.filter(c => {
    const key = `${c.name}|${c.domain}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function showStatus(msg, isError) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = isError ? 'error' : 'success';
  el.style.display = 'block';
}

document.getElementById('extract').addEventListener('click', async () => {
  try {
    const cookies = await extractCookies();
    const json = JSON.stringify(cookies, null, 2);
    await navigator.clipboard.writeText(json);
    showStatus(`Copied ${cookies.length} cookies to clipboard!`, false);
  } catch (e) {
    showStatus(`Error: ${e.message}`, true);
  }
});

document.getElementById('download').addEventListener('click', async () => {
  try {
    const cookies = await extractCookies();
    const json = JSON.stringify(cookies, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nlm-cookies-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus(`Downloaded ${cookies.length} cookies!`, false);
  } catch (e) {
    showStatus(`Error: ${e.message}`, true);
  }
});
