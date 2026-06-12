/**
 * api.js — Google Apps Script API layer
 * All network calls go through this module.
 */

const API = (() => {

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
     * Returns { version: "1.1.0" } — the deployed AppScript version.
     */
    fetchVersion() {
      return get('version');
    },

    /**
     * GET ?action=config
     * Returns { categories: [], mapping: {} }
     */
    fetchConfig() {
      return get('config');
    },

    /**
     * GET ?action=dashboard
     * Returns { month, totalSpent, monthlyLimit, remaining, budgetPercent, categoryTotals }
     */
    fetchDashboard() {
      return get('dashboard');
    },

    /**
     * GET ?action=recent
     * Returns array of last 20 expense objects
     */
    fetchRecent() {
      return get('recent');
    },

    /**
     * GET ?action=analytics
     * Returns { categoryBreakdown, sourceBreakdown, monthlyTrend, recentExpenses }
     */
    fetchAnalytics() {
      return get('analytics');
    },

    /**
     * GET ?action=filters
     * Returns { categories: [], sources: [], tags: [] }
     */
    fetchFilters() {
      return get('filters');
    },

    /**
     * GET ?action=search&q=...&category=...&source=...&tag=...&from=...&to=...&limit=50
     * Server-side filtered search. Returns array of matching expense objects (newest first).
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
      });
    },

    /**
     * POST { action: "undo" }
     * Removes the last row from the sheet
     */
    undoLast() {
      return post({ action: 'undo' });
    }
  };

})();
