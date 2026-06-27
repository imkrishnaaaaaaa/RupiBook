/**
 * api.js — Google Apps Script API layer
 * All network calls go through this module.
 *
 * Includes ApiCache: a localStorage-backed cache layer keyed per active profile.
 * TTLs: dashboard/analytics/filters = 60 min, config = 24 hr. Search is never cached.
 * Cache is busted automatically when saveExpense() succeeds.
 */

/* ═══════════════════════════════════════════
   ApiCache — localStorage cache, per-profile
═══════════════════════════════════════════ */
const ApiCache = (() => {
  const PREFIX = 'rb_apicache_';

  /** Build the namespaced key for the current profile. */
  function key(action) {
    const profile = getCurrentProfile(); // from storage.js
    return `${PREFIX}${profile}_${action}`;
  }

  return {
    /**
     * Retrieve a cached entry if it exists and is within the TTL.
     * @param {string} action
     * @param {number} ttlMs  — TTL in milliseconds
     * @returns {{ data: any, ageMs: number } | null}
     */
    get(action, ttlMs) {
      try {
        const raw = localStorage.getItem(key(action));
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (!entry || !entry.ts || !entry.data) return null;
        const ageMs = Date.now() - entry.ts;
        if (ageMs > ttlMs) return null; // expired
        return { data: entry.data, ageMs };
      } catch (_) {
        return null;
      }
    },

    /**
     * Store a response in the cache with the current timestamp.
     * @param {string} action
     * @param {any}    data
     */
    set(action, data) {
      try {
        localStorage.setItem(key(action), JSON.stringify({ data, ts: Date.now() }));
      } catch (_) { /* quota exceeded or private browsing — silently skip */ }
    },

    /**
     * Remove specific cache entries for the current profile.
     * @param {...string} actions
     */
    invalidate(...actions) {
      actions.forEach(action => {
        try { localStorage.removeItem(key(action)); } catch (_) { /* ignore */ }
      });
    },

    /**
     * Returns the age of a cached entry in ms, or null if not cached.
     * Does NOT check TTL — returns age even if the entry is stale.
     * @param {string} action
     * @returns {number | null}
     */
    getAge(action) {
      try {
        const raw = localStorage.getItem(key(action));
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (!entry || !entry.ts) return null;
        return Date.now() - entry.ts;
      } catch (_) {
        return null;
      }
    }
  };
})();

/* ═══════════════════════════════════════════
   API — Google Apps Script REST layer
═══════════════════════════════════════════ */
const API = (() => {

  const DASHBOARD_TTL = 60 * 60 * 1000;   // 60 minutes
  const ANALYTICS_TTL = 60 * 60 * 1000;   // 60 minutes
  const FILTERS_TTL   = 60 * 60 * 1000;   // 60 minutes
  const CONFIG_TTL    = 24 * 60 * 60 * 1000; // 24 hours

  function getUrl() {
    const profile = getActiveProfile();
    if (!profile || !profile.apiUrl) {
      throw new Error('No API URL configured. Please set it in Settings.');
    }
    return profile.apiUrl;
  }

  async function get(action) {
    const url = getUrl();
    const res = await fetch(`${url}?action=${action}`, {
      method: 'GET',
      redirect: 'follow'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function post(payload) {
    const url = getUrl();
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  return {
    /**
     * GET ?action=version
     * Returns { version } — always live, never cached.
     */
    fetchVersion() {
      return get('version');
    },

    /**
     * GET ?action=config
     * Returns { categories: [], mapping: {}, paymentModes: [] }
     * Cached for 24 hours — changes only when Config sheet is edited.
     */
    fetchConfig() {
      const cached = ApiCache.get('config', CONFIG_TTL);
      if (cached) return Promise.resolve(cached.data);
      return get('config').then(data => { ApiCache.set('config', data); return data; });
    },

    /**
     * GET ?action=dashboard
     * Returns { month, totalSpent, monthlyLimit, remaining, budgetPercent, categoryTotals, categoryBudgets }
     * Cached for 60 minutes.
     */
    fetchDashboard() {
      const cached = ApiCache.get('dashboard', DASHBOARD_TTL);
      if (cached) return Promise.resolve(cached.data);
      return get('dashboard').then(data => { ApiCache.set('dashboard', data); return data; });
    },

    /**
     * GET ?action=recent
     * Returns array of last 20 expense objects — NOT cached (used only as fallback).
     */
    fetchRecent() {
      return get('recent');
    },

    /**
     * GET ?action=analytics
     * Returns { categoryBreakdown, sourceBreakdown, monthlyTrend, recentExpenses, monthlyBudget }
     * Cached for 60 minutes.
     */
    fetchAnalytics() {
      const cached = ApiCache.get('analytics', ANALYTICS_TTL);
      if (cached) return Promise.resolve(cached.data);
      return get('analytics').then(data => { ApiCache.set('analytics', data); return data; });
    },

    /**
     * GET ?action=filters
     * Returns { categories: [], sources: [], tags: [] }
     * Cached for 60 minutes.
     */
    fetchFilters() {
      const cached = ApiCache.get('filters', FILTERS_TTL);
      if (cached) return Promise.resolve(cached.data);
      return get('filters').then(data => { ApiCache.set('filters', data); return data; });
    },

    /**
     * GET ?action=search&q=...&category=...&source=...&tag=...&from=...&to=...&limit=50
     * Server-side filtered search — NEVER cached (user-driven, always fresh).
     */
    fetchSearch(params = {}) {
      const url = getUrl();
      const qs = new URLSearchParams({ action: 'search' });
      if (params.q)        qs.set('q', params.q);
      if (params.category) qs.set('category', params.category);
      if (params.source)   qs.set('source', params.source);
      if (params.tag)      qs.set('tag', params.tag);
      if (params.from)     qs.set('from', params.from);
      if (params.to)       qs.set('to', params.to);
      if (params.limit)    qs.set('limit', String(params.limit));
      return fetch(`${url}?${qs.toString()}`, { method: 'GET', redirect: 'follow' })
        .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); });
    },

    /**
     * POST expense data
     * Busts dashboard + analytics cache after a successful save so the next
     * Dashboard load always reflects the new expense.
     * @param {{ amount, category, source, paymentMode, tags, comments }} data
     */
    saveExpense(data) {
      return post({
        amount:      Number(data.amount),
        category:    data.category    || '',
        source:      data.source      || '',
        paymentMode: data.paymentMode || '',
        tags:        data.tags        || '',
        comments:    data.comments    || ''
      }).then(res => {
        // Invalidate so the next visit fetches fresh totals
        ApiCache.invalidate('dashboard', 'analytics');
        return res;
      });
    },

    /**
     * POST { action: "undo" }
     * Removes the last row from the sheet. Also busts cache.
     */
    undoLast() {
      return post({ action: 'undo' }).then(res => {
        ApiCache.invalidate('dashboard', 'analytics');
        return res;
      });
    }
  };

})();
