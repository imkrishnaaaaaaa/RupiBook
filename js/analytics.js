/**
 * analytics.js — Analytics page with server-side search
 *
 * On initial load: fetches filter chip data + full current-month expenses via
 * the search endpoint (so totals match the Dashboard). Limit raised to 200.
 * On search: sends all active filters to the server-side ?action=search endpoint.
 */

const Analytics = (() => {

  let allExpenses = [];
  let filterState = {
    categories: [],
    sources: [],
    tags: [],
    dateFrom: '',
    dateTo: '',
    tagSearch: ''
  };

  /* ── Get current month date range ── */
  function getCurrentMonthRange() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    return {
      from: `${y}-${m}-01`,
      to:   `${y}-${m}-${String(lastDay).padStart(2, '0')}`
    };
  }

  /* ── Filter blank rows (allow ₹0 amounts) ── */
  function filterBlank(arr) {
    return (arr || []).filter(e => e.amount !== '' && e.amount !== null && e.amount !== undefined && e.category && e.timestamp);
  }

  /* ── Apply chip/date filters client-side (used on initial load data only) ── */
  function applyFilters(expenses) {
    return expenses.filter(e => {
      const { categories, sources, tags, dateFrom, dateTo } = filterState;

      if (categories.length && !categories.includes(e.category)) return false;
      if (sources.length   && !sources.includes(e.source))       return false;

      if (tags.length) {
        const eTags = (e.tags || '').split(/\s+/).map(t => t.trim().toLowerCase());
        const matches = tags.some(t => eTags.includes(t.toLowerCase()));
        if (!matches) return false;
      }

      if (dateFrom) {
        const d = new Date(e.timestamp);
        if (isNaN(d) || d < new Date(dateFrom)) return false;
      }

      if (dateTo) {
        const d = new Date(e.timestamp);
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (isNaN(d) || d > to) return false;
      }

      return true;
    });
  }

  /* ── Render filter chips ── */
  function renderFilterChips(containerId, items, stateKey) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = items.length
      ? items.map(item => `
          <button class="filter-chip ${filterState[stateKey].includes(item) ? 'selected' : ''}"
                  data-value="${escapeHtml(item)}"
                  data-key="${stateKey}">
            ${escapeHtml(item)}
          </button>
        `).join('')
      : `<span class="text-muted" style="font-size:13px">None available</span>`;

    container.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const key = chip.dataset.key;
        const val = chip.dataset.value;
        const arr = filterState[key];
        const idx = arr.indexOf(val);
        if (idx === -1) arr.push(val); else arr.splice(idx, 1);
        chip.classList.toggle('selected', filterState[key].includes(val));
        renderResults();
      });
    });
  }

  /* ── Render summary stats ── */
  function renderSummary(expenses) {
    const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const bycat = {};
    expenses.forEach(e => { bycat[e.category] = (bycat[e.category] || 0) + (Number(e.amount) || 0); });
    const topCat = Object.entries(bycat).sort(([,a],[,b]) => b - a)[0];

    const el = id => document.getElementById(id);
    if (el('aTotalSpent'))  el('aTotalSpent').textContent  = fmtMoney(total);
    if (el('aCount'))       el('aCount').textContent       = expenses.length;
    if (el('aTopCategory')) el('aTopCategory').textContent = topCat ? topCat[0] : '—';
  }

  /* ── Render filtered results list ── */
  function renderResults() {
    const filtered = applyFilters(allExpenses);
    renderSummary(filtered);

    const list = document.getElementById('aResultsList');
    if (!list) return;

    if (!filtered.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No expenses match your filters.</p>
        </div>`;
      return;
    }

    list.innerHTML = filtered.map(e => `
      <div class="expense-item">
        <div class="expense-icon ${getCatClass(e.category)}">${getCatIcon(e.category)}</div>
        <div class="expense-info">
          <div class="expense-category">${e.category}
            ${e.tags ? `<span style="margin-left:6px;font-size:11px;color:var(--primary)">${e.tags}</span>` : ''}
          </div>
          <div class="expense-source">${e.source || '—'} · ${e.paymentMode || ''}</div>
          ${e.comments ? `<div class="expense-source" style="font-style:italic">${e.comments}</div>` : ''}
        </div>
        <div class="expense-meta">
          <div class="expense-amount">${fmtMoney(e.amount)}</div>
          <div class="expense-time">${fmtDate(e.timestamp)}</div>
        </div>
      </div>
    `).join('');
  }

  /* ── Server-side search ── */
  async function performSearch() {
    const searchBtn = document.getElementById('anaSearchBtn');
    if (searchBtn) {
      searchBtn.disabled = true;
      searchBtn.textContent = 'Searching…';
    }

    try {
      const params = {};

      // Only send one category/source if a single chip is selected;
      // multiple selections are filtered client-side from the results.
      if (filterState.categories.length === 1) params.category = filterState.categories[0];
      if (filterState.sources.length === 1)    params.source   = filterState.sources[0];
      if (filterState.tags.length === 1)       params.tag      = filterState.tags[0];
      if (filterState.tagSearch)               params.q        = filterState.tagSearch;
      if (filterState.dateFrom)                params.from     = filterState.dateFrom;
      if (filterState.dateTo)                  params.to       = filterState.dateTo;
      params.limit = 250; // higher limit for accurate totals

      const results = await API.fetchSearch(params);
      allExpenses = filterBlank(results || []);
      renderResults();
    } catch (e) {
      showToast({ icon: '❌', title: 'Search Failed', message: e.message });
    } finally {
      if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.textContent = '🔎 Search';
      }
    }
  }

  /* ── Load page ── */
  async function load() {
    const loadingEl = document.getElementById('anaLoadingState');
    const contentEl = document.getElementById('anaContent');
    if (loadingEl) loadingEl.style.display = 'flex';
    if (contentEl) contentEl.style.display = 'none';

    // Apply current-month default if no date range is set
    if (!filterState.dateFrom && !filterState.dateTo) {
      const range = getCurrentMonthRange();
      filterState.dateFrom = range.from;
      filterState.dateTo   = range.to;
      const fromEl = document.getElementById('anaDateFrom');
      const toEl   = document.getElementById('anaDateTo');
      if (fromEl) fromEl.value = range.from;
      if (toEl)   toEl.value   = range.to;
    }

    try {
      const [filtersData, analyticsData] = await Promise.all([
        API.fetchFilters(),
        API.fetchAnalytics()
      ]);

      // Use server-side search for the active date range so totals match
      // the Dashboard (which sums the full month, not just last-20 rows).
      const searchParams = { limit: 200 };
      if (filterState.dateFrom) searchParams.from = filterState.dateFrom;
      if (filterState.dateTo)   searchParams.to   = filterState.dateTo;
      const searchResults = await API.fetchSearch(searchParams);
      allExpenses = filterBlank(searchResults || []);

      renderFilterChips('anaCategoryChips', filtersData.categories || [], 'categories');
      renderFilterChips('anaSourceChips',   filtersData.sources   || [], 'sources');

      // Build top-10 tags sorted by usage count from loaded expenses
      const tagCountMap = {};
      (analyticsData.recentExpenses || []).forEach(e => {
        (e.tags || '').split(/\s+/).forEach(t => {
          const trimmed = t.trim().toLowerCase();
          if (trimmed) tagCountMap[trimmed] = (tagCountMap[trimmed] || 0) + 1;
        });
      });
      const top10Tags = Object.entries(tagCountMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([tag]) => tag);
      renderFilterChips('anaTagChips', top10Tags, 'tags');

      renderResults();

      if (contentEl) contentEl.style.display = 'block';
    } catch (e) {
      if (contentEl) {
        contentEl.style.display = 'block';
        contentEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <p>${e.message}</p>
          </div>`;
      }
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  /* ── Wire up filter controls ── */
  function bindControls() {
    document.getElementById('anaDateFrom')?.addEventListener('change', e => {
      filterState.dateFrom = e.target.value;
      renderResults();
    });

    document.getElementById('anaDateTo')?.addEventListener('change', e => {
      filterState.dateTo = e.target.value;
      renderResults();
    });

    // Search input: update filter state but do NOT auto-search on every keystroke.
    // The user clicks the Search button to trigger the server-side search.
    document.getElementById('anaTagSearch')?.addEventListener('input', e => {
      filterState.tagSearch = e.target.value.trim();
    });

    // Enter key in search input triggers search
    document.getElementById('anaTagSearch')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
      }
    });

    // Search button
    document.getElementById('anaSearchBtn')?.addEventListener('click', () => performSearch());

    document.getElementById('anaResetBtn')?.addEventListener('click', () => {
      const range = getCurrentMonthRange();
      filterState = { categories: [], sources: [], tags: [], dateFrom: range.from, dateTo: range.to, tagSearch: '' };
      const fromEl = document.getElementById('anaDateFrom');
      const toEl   = document.getElementById('anaDateTo');
      const searchEl = document.getElementById('anaTagSearch');
      if (fromEl)   fromEl.value   = range.from;
      if (toEl)     toEl.value     = range.to;
      if (searchEl) searchEl.value = '';
      load();
    });

    document.getElementById('anaRefreshBtn')?.addEventListener('click', () => load());
  }

  /* ── Helper ── */
  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Wire controls once on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', bindControls);

  return { load };

})();
