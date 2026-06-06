/**
 * analytics.js — Analytics page with client-side filtering
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

  /* ── Filter blank rows ── */
  function filterBlank(arr) {
    return (arr || []).filter(e => e.amount && e.category && e.timestamp);
  }

  /* ── Apply filters client-side ── */
  function applyFilters(expenses) {
    return expenses.filter(e => {
      const { categories, sources, tags, dateFrom, dateTo, tagSearch } = filterState;

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

      if (tagSearch) {
        const q = tagSearch.toLowerCase();
        const inTags     = (e.tags     || '').toLowerCase().includes(q);
        const inCategory = (e.category || '').toLowerCase().includes(q);
        const inSource   = (e.source   || '').toLowerCase().includes(q);
        const inComments = (e.comments || '').toLowerCase().includes(q);
        if (!inTags && !inCategory && !inSource && !inComments) return false;
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

  /* ── Load page ── */
  async function load() {
    const loadingEl = document.getElementById('anaLoadingState');
    const contentEl = document.getElementById('anaContent');
    if (loadingEl) loadingEl.style.display = 'flex';
    if (contentEl) contentEl.style.display = 'none';

    try {
      const [filtersData, analyticsData] = await Promise.all([
        API.fetchFilters(),
        API.fetchAnalytics()
      ]);

      allExpenses = filterBlank(analyticsData.recentExpenses || []);

      renderFilterChips('anaCategoryChips', filtersData.categories || [], 'categories');
      renderFilterChips('anaSourceChips',   filtersData.sources   || [], 'sources');
      renderFilterChips('anaTagChips',      filtersData.tags      || [], 'tags');

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

    document.getElementById('anaTagSearch')?.addEventListener('input', e => {
      filterState.tagSearch = e.target.value.trim();
      renderResults();
    });

    document.getElementById('anaResetBtn')?.addEventListener('click', () => {
      filterState = { categories: [], sources: [], tags: [], dateFrom: '', dateTo: '', tagSearch: '' };
      document.getElementById('anaDateFrom').value = '';
      document.getElementById('anaDateTo').value   = '';
      document.getElementById('anaTagSearch').value = '';
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
