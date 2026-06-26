/**
 * app.js — SPA router + Home page + global utilities (v2)
 */

/* ─── App State ─── */
const App = {
  currentPage: 'home',
  returnPage:  'home',   // last main page — where sub-pages (code/docs) return to
  configData:  null,
  toastTimer:  null,
  pwaPrompt:   null,
  // Tracks which tags were auto-added per slot so they can be swapped on change
  autoTagSlots: { category: [], source: [], paymentMode: [] },
};

/* ─── Category Icons / Colors ─── */
const CAT_ICONS = {
  Food: '🍔', Transport: '🚗', Shopping: '🛍️', Bills: '💡',
  Health: '💊', Entertainment: '🎬', Groceries: '🛒', Others: '💰'
};
const CAT_COLORS = {
  Food: 'cat-food', Transport: 'cat-transport', Shopping: 'cat-shopping',
  Bills: 'cat-bills', Health: 'cat-health', Entertainment: 'cat-entertainment',
  Groceries: 'cat-health', Others: 'cat-others'
};

function getCatIcon(cat)  { return CAT_ICONS[cat]  || '💰'; }
function getCatClass(cat) { return CAT_COLORS[cat] || 'cat-others'; }

/* ─── Formatters ─── */
function fmtMoney(n) {
  n = Math.round(Number(n) || 0);
  if (n < 1000) return '₹' + n;
  return '₹' + n.toLocaleString('en-IN');
}

function fmtMoneyFull(n) {
  return '₹' + (Number(n) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return String(ts).slice(0, 16);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' +
         d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Theme ─── */
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark');
  } else if (theme === 'light') {
    document.body.classList.remove('dark');
  } else {
    // system
    document.body.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  updateThemeIcon();
}

function getTheme() {
  const p = getActiveProfile();
  return (p && p.theme) || APP_CONFIG.DEFAULT_THEME;
}

function updateThemeIcon() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const theme = getTheme();
  // Show CURRENT state icon: dark=🌙, light=☀️, system=💻
  btn.textContent = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '💻';
}

/* ─── Browser Notifications ─── */
const Notifications = {
  isSupported() { return 'Notification' in window; },
  isGranted()   { return this.isSupported() && Notification.permission === 'granted'; },

  async request() {
    if (!this.isSupported()) return false;
    if (Notification.permission === 'granted') return true;
    const perm = await Notification.requestPermission();
    Settings.renderNotifications();
    return perm === 'granted';
  },

  send(title, body) {
    if (!this.isGranted()) return;
    try {
      new Notification(title, {
        body,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'expense-save'
      });
    } catch (_) { /* Blocked on file:// in some browsers */ }
  }
};

/* ─── Toast ─── */
function showToast(opts) {
  const toast = document.getElementById('toast');
  const profile = getActiveProfile();
  const autoHide = profile ? profile.autoHideToast !== false : true;

  const undoHtml = opts.undoable
    ? `<button class="toast-undo" id="toastUndoBtn">↩ Undo</button>`
    : '';

  toast.innerHTML = `
    <div class="toast-inner">
      <div class="toast-icon">${opts.icon || 'ℹ️'}</div>
      <div class="toast-body">
        <div class="toast-header-row">
          <div class="toast-title">${escapeHtml(opts.title || '')}</div>
          <div class="toast-header-actions">
            ${undoHtml}
            <button class="toast-close" id="toastCloseBtn" aria-label="Close">✕</button>
          </div>
        </div>
        ${opts.message ? `<div class="toast-msg">${opts.message}</div>` : ''}
      </div>
    </div>
  `;

  toast.className = 'show';

  document.getElementById('toastCloseBtn')?.addEventListener('click', hideToast);

  if (opts.undoable) {
    document.getElementById('toastUndoBtn')?.addEventListener('click', async () => {
      hideToast();
      try {
        const res = await API.undoLast();
        showToast({ icon: '↩️', title: 'Undone', message: res.message || 'Last entry removed.' });
      } catch (e) {
        showToast({ icon: '❌', title: 'Error', message: e.message });
      }
    });
  }

  clearTimeout(App.toastTimer);
  if (autoHide) {
    App.toastTimer = setTimeout(hideToast, APP_CONFIG.TOAST_DURATION);
  }
}

function hideToast() {
  document.getElementById('toast').className = '';
  clearTimeout(App.toastTimer);
}

/* ─── Page Navigation ─── */
// Pages reachable from the bottom nav (used to remember where sub-pages go "Back" to)
const MAIN_PAGES = ['home', 'dashboard', 'analytics', 'settings'];

function navigateTo(page) {
  App.currentPage = page;
  // Remember the last main page so sub-page "Back" buttons know where to return.
  if (MAIN_PAGES.includes(page)) App.returnPage = page;

  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.getElementById(`${page}Page`)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  const isHome = page === 'home';
  const actionBar = document.querySelector('.action-bar');
  const bottomNav = document.querySelector('.bottom-nav');

  actionBar?.classList.toggle('hidden', !isHome);
  // Nav floats above the action-bar only on home; elsewhere it rests at screen bottom
  bottomNav?.classList.toggle('nav-above-bar', isHome);
  // Body bottom padding: extra space for action-bar only on home
  document.body.classList.toggle('no-action-bar', !isHome);

  if (page === 'dashboard')  Dashboard.load();
  if (page === 'analytics')  Analytics.load();
  if (page === 'settings')   Settings.render();
  if (page === 'codeViewer') { CodeViewer.render(); window.scrollTo(0, 0); }
  if (page === 'docs')       { Docs.render();       window.scrollTo(0, 0); }
}

/* ═══════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════ */
const Home = {

  async init() {
    this.bindNavigation();
    this.bindActions();
    await this.loadConfig();
  },

  bindNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn =>
      btn.addEventListener('click', () => navigateTo(btn.dataset.page))
    );
  },

  bindActions() {
    document.getElementById('clearBtn')?.addEventListener('click', () => this.clearForm());
    document.getElementById('saveBtn')?.addEventListener('click',  () => this.saveExpense());

    // Theme toggle: cycle light → dark → system
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      const cur  = getTheme();
      const next = cur === 'light' ? 'dark' : cur === 'dark' ? 'system' : 'light';
      const profile = getActiveProfile();
      if (profile) { profile.theme = next; saveActiveProfile(profile); }
      applyTheme(next);
      Settings.renderThemeSelector();
    });

    // Category → populate sources + SWAP auto-tags (remove old cat+source tags, add new)
    document.getElementById('category')?.addEventListener('change', e => {
      this.populateSources(e.target.value);
      // Remove previous category and source auto-tags
      this.removeSlotTags('category');
      this.removeSlotTags('source');
      // Add new category tags
      if (e.target.value) this.setSlotTags('category', e.target.value);
    });

    // Source → SWAP auto-tags
    document.getElementById('source')?.addEventListener('change', e => {
      this.removeSlotTags('source');
      if (e.target.value) this.setSlotTags('source', e.target.value);
    });

    // Payment mode → SWAP auto-tags
    document.getElementById('paymentMode')?.addEventListener('change', e => {
      this.removeSlotTags('paymentMode');
      if (e.target.value) this.setSlotTags('paymentMode', e.target.value);
    });

    // Tags input → live chip preview
    document.getElementById('tags')?.addEventListener('input', () => this.renderTagChips());

    // Comments → update tag preview (shows comment-derived tags as preview)
    document.getElementById('comments')?.addEventListener('input', () => this.renderTagChips());
  },

  /* ─── Config / Categories ─── */
  async loadConfig() {
    let profile = getActiveProfile();

    // Migration: if stored profile has no URL, check PRESET_PROFILES
    if (profile && !profile.apiUrl) {
      const presetName = getCurrentProfile();
      const preset     = PRESET_PROFILES[presetName];
      if (preset && preset.apiUrl) {
        profile.apiUrl = preset.apiUrl;
        saveActiveProfile(profile);
      }
    }

    this.populatePaymentModes();

    const catSel = document.getElementById('category');
    if (!catSel) return;

    if (!profile || !profile.apiUrl) {
      catSel.innerHTML = '<option value="">⚠️ Set API URL in Settings…</option>';
      return;
    }

    catSel.innerHTML = '<option value="">Loading…</option>';

    try {
      const cfg   = await API.fetchConfig();
      App.configData = cfg;
      this.populateCategories(cfg.categories);
      
      if (cfg.paymentModes && cfg.paymentModes.length > 0) {
        profile.paymentModes = cfg.paymentModes;
        saveActiveProfile(profile);
        this.populatePaymentModes();
        Settings.renderPaymentModes();
      }
    } catch (e) {
      catSel.innerHTML = '<option value="">Failed to load categories</option>';
      showToast({ icon: '⚠️', title: 'Config Error', message: e.message });
    }
  },

  populateCategories(cats) {
    const sel = document.getElementById('category');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select category…</option>';
    (cats || []).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = `${getCatIcon(c)} ${c}`;
      sel.appendChild(opt);
    });
    this.populateSources('');
  },

  populateSources(category) {
    const sel = document.getElementById('source');
    if (!sel) return;
    const sources = (App.configData?.mapping?.[category]) || [];
    sel.innerHTML = '<option value="">Select source…</option>';
    sources.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      sel.appendChild(opt);
    });
  },

  populatePaymentModes() {
    const sel    = document.getElementById('paymentMode');
    if (!sel) return;
    const profile = getActiveProfile();
    const modes   = profile?.paymentModes || APP_CONFIG.DEFAULT_PAYMENT_MODES;
    sel.innerHTML = '<option value="">Select payment mode…</option>';
    modes.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = m;
      sel.appendChild(opt);
    });
  },

  /* ─── Slot-based Auto-Tag Helpers ─── */
  // Converts a dropdown display value to one or more hashtags.
  // Spaces are removed (e.g. "Super Money" → #SuperMoney).
  // '/' splits into separate tags (e.g. "Rapido / Uber" → #Rapido #Uber).
  valueToTags(value) {
    return String(value)
      .split('/')                                          // split on '/'
      .map(part => part.trim())                            // trim whitespace around each part
      .filter(part => part.length > 0)                     // drop empty parts
      .map(part => part.replace(/\s+/g, ''))               // remove internal spaces
      .map(part => part.replace(/[^a-zA-Z0-9]/g, ''))      // strip non-alphanumeric chars
      .filter(w => w.length > 1)                           // skip single-char fragments
      .map(w => '#' + w);
  },

  // Set auto-tags for a slot: removes old tags for that slot, adds new ones
  setSlotTags(slot, value) {
    const newTags = this.valueToTags(value);
    App.autoTagSlots[slot] = newTags;
    newTags.forEach(t => this.addTag(t));
  },

  // Remove all tags belonging to a slot from the input
  removeSlotTags(slot) {
    const toRemove = App.autoTagSlots[slot] || [];
    if (!toRemove.length) return;
    const input = document.getElementById('tags');
    if (!input) return;
    const current = input.value.split(/\s+/).filter(Boolean);
    const remaining = current.filter(t =>
      !toRemove.includes(t.toLowerCase()) &&
      !toRemove.includes((t.startsWith('#') ? t : '#'+t).toLowerCase())
    );
    input.value = remaining.join(' ');
    App.autoTagSlots[slot] = [];
    this.renderTagChips();
  },

  // Returns all tags currently in the input as normalised array
  getInputTags() {
    const val = document.getElementById('tags')?.value || '';
    return val.split(/\s+/).filter(Boolean)
      .map(t => t.startsWith('#') ? t.toLowerCase() : '#' + t.toLowerCase());
  },

  // Add a single tag (no-op if duplicate)
  addTag(tag) {
    const input = document.getElementById('tags');
    if (!input) return;
    const existing = new Set(this.getInputTags());
    const norm = tag.startsWith('#') ? tag.toLowerCase() : '#' + tag.toLowerCase();
    if (!existing.has(norm)) {
      input.value = (input.value ? input.value + ' ' : '') + norm;
      this.renderTagChips();
    }
  },

  // Remove a specific tag from the input
  removeTag(tag) {
    const input = document.getElementById('tags');
    if (!input) return;
    const norm = tag.toLowerCase();
    const tags = input.value.split(/\s+/).filter(t =>
      t.toLowerCase() !== norm && t.replace(/^#/, '').toLowerCase() !== norm.replace(/^#/, '')
    );
    input.value = tags.join(' ');
    // Also remove from slot tracking so it doesn't get re-added
    Object.keys(App.autoTagSlots).forEach(slot => {
      App.autoTagSlots[slot] = App.autoTagSlots[slot].filter(t => t !== norm);
    });
    this.renderTagChips();
  },

  // Words from comments that become preview tags on save
  extractCommentTags() {
    const text = document.getElementById('comments')?.value || '';
    if (!text.trim()) return [];
    const STOP = new Set(['the','a','an','is','in','at','to','of','on','and','or','for',
      'with','from','was','are','been','have','this','that','just','its','not','but']);
    return [...new Set(
      text.trim().toLowerCase()
        .split(/\s+/)
        .map(w => w.replace(/[^a-z0-9]/g, ''))
        .filter(w => w.length > 2 && !STOP.has(w))
        .map(w => '#' + w)
    )];
  },

  // Render tag chips with × buttons (typed tags) + greyed comment preview
  renderTagChips() {
    const preview = document.getElementById('tagsPreview');
    if (!preview) return;

    const typedRaw  = (document.getElementById('tags')?.value || '').split(/\s+/).filter(Boolean);
    const typedTags = [...new Set(typedRaw.map(t => t.startsWith('#') ? t.toLowerCase() : '#' + t.toLowerCase()))];

    const commentTags = this.extractCommentTags()
      .filter(t => !typedTags.includes(t));

    if (!typedTags.length && !commentTags.length) {
      preview.innerHTML = '';
      return;
    }

    const typed = typedTags.map(t => `
      <span class="tag-chip">
        ${escapeHtml(t)}
        <button class="tag-remove-btn" onclick="Home.removeTag('${escapeHtml(t)}')" aria-label="Remove">×</button>
      </span>`).join('');

    const comment = commentTags.map(t => `
      <span class="tag-chip tag-chip-preview" title="Will be added from comment on save">${escapeHtml(t)}</span>
    `).join('');

    preview.innerHTML = typed + comment;
  },

  clearForm() {
    document.getElementById('amount').value   = '';
    document.getElementById('tags').value     = '';
    document.getElementById('comments').value = '';
    ['category', 'source', 'paymentMode'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.selectedIndex = 0;
    });
    this.populateSources('');
    // Reset all slot tracking
    App.autoTagSlots = { category: [], source: [], paymentMode: [] };
    document.getElementById('tagsPreview').innerHTML = '';
    document.getElementById('amount')?.focus();
  },

  async saveExpense() {
    const amountVal = document.getElementById('amount')?.value;
    const amount    = parseFloat(amountVal);
    if (isNaN(amount) || amount < 0) {
      showToast({ icon: '⚠️', title: 'Validation', message: 'Please enter a valid amount (0 or more).' });
      document.getElementById('amount')?.focus();
      return;
    }

    const category = document.getElementById('category')?.value;
    if (!category) {
      showToast({ icon: '⚠️', title: 'Validation', message: 'Please select a category.' });
      return;
    }

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      // Merge comment-derived tags into the tags input before saving
      this.extractCommentTags().forEach(t => this.addTag(t));

      const data = {
        amount,
        category,
        source:      document.getElementById('source')?.value      || '',
        paymentMode: document.getElementById('paymentMode')?.value  || '',
        tags:        document.getElementById('tags')?.value         || '',
        comments:    document.getElementById('comments')?.value     || ''
      };

      const res = await API.saveExpense(data);
      const msg = res.message || `${fmtMoney(amount)} · ${category}`;

      showToast({ icon: '✅', title: 'Expense Saved', message: msg, undoable: true });
      Notifications.send('✅ Expense Saved', `${fmtMoney(amount)} · ${category}`);

      this.clearForm();

      // Non-blocking version check on add (uses the 6h cache, so it rarely hits
      // the network) — surfaces the update banner if the backend is outdated.
      VersionCheck.check();
    } catch (e) {
      showToast({ icon: '❌', title: 'Save Failed', message: e.message });
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Save Expense';
    }
  }
};

/* ═══════════════════════════════════════════
   SETTINGS PAGE
═══════════════════════════════════════════ */
const Settings = {

  render() {
    this.renderProfiles();
    this.renderThemeSelector();
    this.renderPaymentModes();
    this.renderApiUrl();
    this.renderAutoHide();
    this.renderNotifications();
    this.renderPwaInstall();
    this.bindActions();
  },

  renderProfiles() {
    const profiles = getProfiles();
    const current  = getCurrentProfile();
    const list     = document.getElementById('profileList');
    if (!list) return;
    const AVATARS  = { Personal: '👤', Family: '👨‍👩‍👧', Friend: '🤝' };

    list.innerHTML = Object.keys(profiles).map(name => {
      const p = profiles[name];
      return `
        <div class="profile-item ${name === current ? 'current' : ''}" data-profile="${escapeHtml(name)}">
          <div class="profile-avatar">${AVATARS[name] || '👤'}</div>
          <div style="flex:1;min-width:0">
            <div class="profile-name">${escapeHtml(name)}</div>
            <div class="profile-url">${p.apiUrl ? '✅ URL configured' : '⚠️ No URL set'}</div>
          </div>
          ${name === current ? '<span style="color:var(--primary);font-size:18px">✓</span>' : ''}
        </div>`;
    }).join('');

    list.querySelectorAll('.profile-item').forEach(el => {
      el.addEventListener('click', () => {
        setCurrentProfile(el.dataset.profile);
        applyTheme(getTheme());
        Home.loadConfig();
        this.render();
        this.updateProfileBadge();
        showToast({ icon: '👤', title: 'Profile Switched', message: el.dataset.profile });
      });
    });
  },

  renderApiUrl() {
    const input   = document.getElementById('apiUrlInput');
    if (!input) return;
    const profile = getActiveProfile();
    input.value   = profile?.apiUrl || '';
  },

  renderThemeSelector() {
    const theme = getTheme();
    document.querySelectorAll('.theme-btn').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.theme === theme)
    );
  },

  renderPaymentModes() {
    const profile   = getActiveProfile();
    const modes     = profile?.paymentModes || APP_CONFIG.DEFAULT_PAYMENT_MODES;
    const container = document.getElementById('paymentModeList');
    if (!container) return;
    container.innerHTML = modes.map((m, i) => `
      <span class="pm-tag">
        ${escapeHtml(m)}
      </span>`).join('');
  },

  renderAutoHide() {
    const profile = getActiveProfile();
    const toggle  = document.getElementById('autoHideToggle');
    if (toggle) toggle.checked = profile ? profile.autoHideToast !== false : true;
  },

  renderNotifications() {
    const statusEl = document.getElementById('notifStatus');
    const btn      = document.getElementById('enableNotifBtn');
    if (!statusEl || !btn) return;

    if (!Notifications.isSupported()) {
      statusEl.textContent = 'Not supported in this browser';
      statusEl.style.color = 'var(--text-3)';
      return;
    }

    const perm = Notification.permission;
    if (perm === 'granted') {
      statusEl.textContent = '🔔 Enabled — you\'ll get confirmations';
      statusEl.style.color = 'var(--success)';
      btn.style.display    = 'inline-flex';
      btn.textContent      = 'Send Test Notification';
      btn.onclick = () => Notifications.send('🔔 Test', 'Notifications are working!');
    } else if (perm === 'denied') {
      statusEl.textContent = '❌ Blocked — enable in browser settings';
      statusEl.style.color = 'var(--danger)';
      btn.style.display    = 'none';
    } else {
      statusEl.textContent = 'Not yet enabled';
      statusEl.style.color = 'var(--text-3)';
      btn.style.display    = 'inline-flex';
      btn.textContent      = '🔔 Enable Notifications';
      btn.onclick = () => Notifications.request();
    }
  },

  renderPwaInstall() {
    const wrap = document.getElementById('pwaInstallWrap');
    const btn  = document.getElementById('pwaInstallBtn');
    if (!wrap || !btn) return;
    if (App.pwaPrompt) {
      wrap.style.display = 'block';
      btn.onclick = async () => {
        App.pwaPrompt.prompt();
        const { outcome } = await App.pwaPrompt.userChoice;
        if (outcome === 'accepted') App.pwaPrompt = null;
        wrap.style.display = 'none';
      };
    }
  },

  bindActions() {
    // Save API URL
    document.getElementById('saveApiUrl')?.addEventListener('click', () => {
      const url     = document.getElementById('apiUrlInput')?.value.trim();
      const profile = getActiveProfile();
      if (profile) {
        profile.apiUrl = url;
        saveActiveProfile(profile);
        Home.loadConfig();
        this.renderProfiles();
        showToast({ icon: '💾', title: 'Saved', message: 'API URL updated.' });
      }
    });

    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const profile = getActiveProfile();
        if (profile) { profile.theme = btn.dataset.theme; saveActiveProfile(profile); }
        applyTheme(btn.dataset.theme);
        this.renderThemeSelector();
      });
    });

    // Auto-hide toggle
    document.getElementById('autoHideToggle')?.addEventListener('change', e => {
      const profile = getActiveProfile();
      if (profile) { profile.autoHideToast = e.target.checked; saveActiveProfile(profile); }
    });

    // Refresh payment modes
    document.getElementById('refreshPaymentModesBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('refreshPaymentModesBtn');
      const origText = btn.textContent;
      btn.textContent = 'Refreshing…';
      btn.disabled = true;
      try {
        const cfg = await API.fetchConfig();
        const profile = getActiveProfile();
        if (profile && cfg.paymentModes && cfg.paymentModes.length > 0) {
          profile.paymentModes = cfg.paymentModes;
          saveActiveProfile(profile);
          Home.populatePaymentModes();
          Settings.renderPaymentModes();
          showToast({ icon: '✅', title: 'Refreshed', message: 'Payment modes synced from Sheets.' });
        } else {
          showToast({ icon: 'ℹ️', title: 'No update', message: 'No payment modes found in Sheets.' });
        }
      } catch (e) {
        showToast({ icon: '❌', title: 'Error', message: 'Failed to refresh: ' + e.message });
      } finally {
        btn.textContent = origText;
        btn.disabled = false;
      }
    });

    // PWA - Check for updates
    document.getElementById('pwaCheckUpdateBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('pwaCheckUpdateBtn');
      const origText = btn.textContent;
      btn.textContent = 'Checking…';
      btn.disabled = true;
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready;
          await reg.update();
          
          if (!reg.installing && !reg.waiting) {
            showToast({ icon: '✅', title: 'Up to date', message: 'You are running the latest version.' });
          } else {
            showToast({ icon: '📥', title: 'Updating', message: 'Installing new version in background…' });
          }
        } else {
          showToast({ icon: 'ℹ️', title: 'PWA Mode', message: 'Service Worker not active or not supported.' });
        }
      } catch (e) {
        showToast({ icon: '❌', title: 'Error', message: 'Failed to check for updates: ' + e.message });
      } finally {
        btn.textContent = origText;
        btn.disabled = false;
      }
    });

    // PWA - Force reload and clear cache
    document.getElementById('pwaHardRefreshBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('pwaHardRefreshBtn');
      const origText = btn.textContent;
      btn.textContent = 'Clearing…';
      btn.disabled = true;
      try {
        if (window.caches) {
          const keys = await caches.keys();
          for (const key of keys) {
            await caches.delete(key);
          }
        }
        // Service Worker APIs throw on file:// protocol — only attempt on HTTP/HTTPS
        if ('serviceWorker' in navigator && location.protocol !== 'file:') {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
        }
        showToast({ icon: '🔄', title: 'Caches Cleared', message: 'Reloading application…' });
        setTimeout(() => {
          window.location.reload(true);
        }, 1000);
      } catch (e) {
        showToast({ icon: '❌', title: 'Error', message: 'Failed to force refresh: ' + e.message });
        btn.textContent = origText;
        btn.disabled = false;
      }
    });
  },

  updateProfileBadge() {
    const badge = document.getElementById('profileBadge');
    if (badge) badge.textContent = getCurrentProfile();
  }
};

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
// Capture PWA install prompt before it disappears
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  App.pwaPrompt = e;
});

document.addEventListener('DOMContentLoaded', async () => {
  // Migrate existing profiles: 'system' theme → light (one-time)
  migrateThemeDefault();

  // Apply theme immediately (no FOUC)
  applyTheme(getTheme());
  Settings.updateProfileBadge();

  // System theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme('system');
  });

  // Init home page
  await Home.init();
  navigateTo('home');

  // Wire up version banner / code viewer / docs buttons (once)
  initVersionFeatures();

  // Fire the version check WITHOUT awaiting — the expense form is already usable.
  // A failed/slow check never blocks or crashes the UI.
  VersionCheck.check();

  // Service worker — only on HTTP/HTTPS, not file://
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => {
        // Proactively check for updates on launch
        reg.update().catch(() => {});
        // Check for updates when the window receives focus (app reopened)
        window.addEventListener('focus', () => {
          reg.update().catch(() => {});
        });
      })
      .catch(err => {
        console.warn('SW registration failed:', err);
      });

    // Reload the page when a new service worker takes over control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }
});
