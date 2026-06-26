/**
 * version.js — Version management, AppScript code viewer & setup docs renderer.
 *
 * Flow (see implementation-plan.md):
 *   • RUPIBOOK_UI_VERSION is the version this UI build expects from the backend.
 *   • The deployed Apps Script reports its version via ?action=version.
 *   • The deployed version is cached in localStorage for 6h (TTL); we only hit
 *     the network again once that TTL expires — or when the user explicitly
 *     taps "Yes, I've updated", which forces a fresh check regardless of TTL.
 *   • On a mismatch we show a dismissible, Android-style modal banner offering:
 *     Copy code · View code · Open docs · "Yes, I've updated".
 *   • All of this is non-blocking: a failed/slow check never blocks the app.
 */

/* ─── Version constant (bump on every release, keep in sync with appscript-source.txt) ─── */
const RUPIBOOK_UI_VERSION = "1.2.4";

/* ─── Tunables ─── */
const VERSION_CACHE_KEY = "rb_versionCache";        // { version, ts }
const VERSION_CACHE_TTL = 6 * 60 * 60 * 1000;       // 6 hours
const APPSCRIPT_SRC_URL = "./appscript-source.txt";
const SETUP_GUIDE_URL   = "./docs/SETUP_GUIDE.md";
const DOCS_URL          = SETUP_GUIDE_URL;          // exposed for the banner link

/* ════════════════════════════════════════════
   Clipboard helper (with execCommand fallback)
════════════════════════════════════════════ */
async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) { /* fall through to legacy path */ }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (_) {
    return false;
  }
}

/* ════════════════════════════════════════════
   AppScript source loader (fetched once, cached in memory)
════════════════════════════════════════════ */
const AppScriptSource = {
  _code: null,
  _promise: null,

  load() {
    if (this._code !== null) return Promise.resolve(this._code);
    if (this._promise) return this._promise;

    this._promise = fetch(APPSCRIPT_SRC_URL)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(text => {
        this._code = text;
        return text;
      })
      .catch(err => {
        this._promise = null;   // allow a retry on the next request
        throw err;
      });

    return this._promise;
  }
};

/* ════════════════════════════════════════════
   Minimal, XSS-safe Markdown → HTML renderer
   (used by the Setup Guide page)
════════════════════════════════════════════ */
function renderMarkdown(src) {
  if (!src || !src.trim()) return '';

  const esc = s => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 1) Pull fenced code blocks out first so their contents aren't reformatted.
  const codeBlocks = [];
  src = src.replace(/```[^\n]*\n([\s\S]*?)```/g, (_m, code) => {
    const i = codeBlocks.length;
    codeBlocks.push(`<pre class="md-pre"><code>${esc(code.replace(/\n$/, ''))}</code></pre>`);
    return `\n[[[CB${i}]]]\n`;
  });

  // Inline formatting (escape first, then apply markdown tokens).
  const inline = (text) => {
    text = esc(text);
    text = text.replace(/`([^`]+)`/g, (_m, c) => `<code class="md-code">${c}</code>`);
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
    text = text.replace(/\b_([^_\s][^_]*?)_\b/g, '<em>$1</em>');
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
      const safe = /^(https?:|mailto:|\.?\/|#)/i.test(url) ? url : '#';
      return `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    return text;
  };

  const lines = src.split('\n');
  const out = [];
  let listType = null;      // 'ul' | 'ol'
  let inQuote = false;

  const closeList  = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
  const closeQuote = () => { if (inQuote)  { out.push('</blockquote>'); inQuote = false; } };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    // Restored code block
    const cb = line.trim().match(/^\[\[\[CB(\d+)\]\]\]$/);
    if (cb) { closeList(); closeQuote(); out.push(codeBlocks[+cb[1]]); continue; }

    // Blank line ends open blocks
    if (!line.trim()) { closeList(); closeQuote(); continue; }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList(); closeQuote();
      const lvl = h[1].length;
      out.push(`<h${lvl} class="md-h md-h${lvl}">${inline(h[2])}</h${lvl}>`);
      continue;
    }

    // Horizontal rule
    if (/^([-*_])(\s*\1){2,}\s*$/.test(line)) {
      closeList(); closeQuote();
      out.push('<hr class="md-hr">');
      continue;
    }

    // Blockquote
    const bq = line.match(/^>\s?(.*)$/);
    if (bq) {
      closeList();
      if (!inQuote) { out.push('<blockquote class="md-bq">'); inQuote = true; }
      out.push(`<p>${inline(bq[1])}</p>`);
      continue;
    }
    closeQuote();

    // Unordered list
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      if (listType !== 'ul') { closeList(); out.push('<ul class="md-ul">'); listType = 'ul'; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    // Ordered list
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (listType !== 'ol') { closeList(); out.push('<ol class="md-ol">'); listType = 'ol'; }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    // Paragraph
    closeList();
    out.push(`<p class="md-p">${inline(line)}</p>`);
  }

  closeList();
  closeQuote();
  return out.join('\n');
}

/* ════════════════════════════════════════════
   Version check + mismatch banner
════════════════════════════════════════════ */
const VersionCheck = {
  _dismissed: false,   // dismissed for this app load (resets on reload)
  _checking:  false,   // guards against overlapping forced checks

  /**
   * Read the deployed version, honouring the 6h TTL cache unless forced.
   * If the backend responds but reports no version (i.e. it predates version
   * tracking), we return the 'unknown' sentinel — which still counts as a
   * mismatch so the user is prompted to deploy the versioned script. Only a
   * thrown network error leaves us with no answer (handled by the caller).
   */
  async _getDeployedVersion(force) {
    if (!force) {
      const cached = Storage.get(VERSION_CACHE_KEY);
      if (cached && cached.version && cached.ts &&
          (Date.now() - cached.ts) < VERSION_CACHE_TTL) {
        return cached.version;
      }
    }

    const res = await API.fetchVersion();   // throws on a network error
    const version = (res && res.version) ? String(res.version) : 'unknown';
    Storage.set(VERSION_CACHE_KEY, { version, ts: Date.now() });
    return version;
  },

  /**
   * Compare deployed vs UI version and show/hide the banner.
   * @param {{force?: boolean}} opts  force=true ignores the TTL cache and is
   *   used by the "Yes, I've updated" button.
   */
  async check({ force = false } = {}) {
    // No backend configured yet → nothing to compare against (first-run setup).
    const profile = getActiveProfile();
    if (!profile || !profile.apiUrl) return;

    if (force) {
      if (this._checking) return;
      this._checking = true;
      this._dismissed = false;   // explicit re-check clears the dismissal
    }

    try {
      const deployed = await this._getDeployedVersion(force);
      if (!deployed) return;     // shouldn't happen, but stay silent if so

      if (deployed === RUPIBOOK_UI_VERSION) {
        this.hideBanner();
        if (force) {
          showToast({ icon: '✅', title: 'Up to date',
            message: `Your AppScript is on v${deployed}.` });
        }
      } else {
        this.showMismatchBanner(deployed);
        if (force) {
          showToast({ icon: '⚠️', title: 'Still outdated',
            message: `Deployed v${deployed}, but v${RUPIBOOK_UI_VERSION} is required.` });
        }
      }
    } catch (err) {
      // Network/parse error → never block, never crash, no banner.
      console.warn('Version check failed:', err);
    } finally {
      if (force) this._checking = false;
    }
  },

  showMismatchBanner(deployedVersion) {
    if (this._dismissed) return;

    const banner = document.getElementById('versionBanner');
    if (!banner) return;

    const cur = document.getElementById('vbCurrentVer');
    const lat = document.getElementById('vbLatestVer');
    if (cur) cur.textContent = deployedVersion === 'unknown' ? 'not detected' : 'v' + deployedVersion;
    if (lat) lat.textContent = 'v' + RUPIBOOK_UI_VERSION;

    banner.style.display = 'flex';
    // next frame → enables CSS entrance transition
    requestAnimationFrame(() => banner.classList.add('show'));
  },

  hideBanner() {
    const banner = document.getElementById('versionBanner');
    if (!banner) return;
    banner.classList.remove('show');
    banner.style.display = 'none';
  },

  dismiss() {
    this._dismissed = true;
    this.hideBanner();
  }
};

/* ════════════════════════════════════════════
   AppScript Code Viewer page
════════════════════════════════════════════ */
const CodeViewer = {
  async render() {
    const codeEl = document.getElementById('codeViewerContent');
    if (!codeEl) return;
    codeEl.textContent = 'Loading…';
    try {
      codeEl.textContent = await AppScriptSource.load();
    } catch (err) {
      codeEl.textContent = '⚠️ Could not load AppScript source (' + err.message + ').';
    }
  },

  async copy() {
    try {
      const code = await AppScriptSource.load();
      const ok = await copyTextToClipboard(code);
      showToast(ok
        ? { icon: '📋', title: 'Copied', message: 'Latest AppScript code copied to clipboard.' }
        : { icon: '⚠️', title: 'Copy failed', message: 'Select the code and copy it manually.' });
    } catch (err) {
      showToast({ icon: '❌', title: 'Error', message: err.message });
    }
  }
};

/* ════════════════════════════════════════════
   Setup Documentation page
════════════════════════════════════════════ */
const Docs = {
  async render() {
    const container = document.getElementById('docsContent');
    if (!container) return;

    container.innerHTML =
      '<div class="loading-state" style="display:flex;padding:24px"><div class="spinner"></div></div>';

    try {
      const res = await fetch(SETUP_GUIDE_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const md = await res.text();
      const html = renderMarkdown(md);
      container.innerHTML = html || this._empty('📖', 'Documentation coming soon',
        'The setup guide hasn’t been written yet — it will appear here once added.');
    } catch (err) {
      container.innerHTML = this._empty('⚠️', 'Couldn\'t load the guide', escapeHtml(err.message));
    }
  },

  _empty(icon, title, msg) {
    return `<div class="docs-empty">
        <div class="docs-empty-icon">${icon}</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${msg}</p>
      </div>`;
  }
};

/* ════════════════════════════════════════════
   Wiring — bind all static buttons once
════════════════════════════════════════════ */
function initVersionFeatures() {
  // ── Mismatch banner buttons ──
  document.getElementById('versionBannerClose')
    ?.addEventListener('click', () => VersionCheck.dismiss());

  document.getElementById('vbCopyCode')
    ?.addEventListener('click', () => CodeViewer.copy());

  document.getElementById('vbShowCode')?.addEventListener('click', () => {
    VersionCheck.dismiss();
    navigateTo('codeViewer');
  });

  document.getElementById('vbOpenDocs')?.addEventListener('click', () => {
    VersionCheck.dismiss();
    navigateTo('docs');
  });

  document.getElementById('vbYesUpdated')
    ?.addEventListener('click', () => VersionCheck.check({ force: true }));

  // ── Code viewer page ──
  document.getElementById('codeViewerBack')
    ?.addEventListener('click', () => navigateTo(App.returnPage || 'home'));
  document.getElementById('codeViewerCopy')
    ?.addEventListener('click', () => CodeViewer.copy());

  // ── Docs page ──
  document.getElementById('docsBack')
    ?.addEventListener('click', () => navigateTo(App.returnPage || 'home'));

  // ── Settings → Help & Documentation links ──
  document.getElementById('openDocsLink')
    ?.addEventListener('click', () => navigateTo('docs'));
  document.getElementById('openCodeLink')
    ?.addEventListener('click', () => navigateTo('codeViewer'));

  // ── Settings → About: show the live UI version ──
  const about = document.getElementById('aboutVersion');
  if (about) about.textContent = 'v' + RUPIBOOK_UI_VERSION;
}
