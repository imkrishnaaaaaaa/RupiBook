/**
 * dashboard.js — Dashboard charts and recent expenses
 */

const Dashboard = (() => {

  let loaded = false;
  let charts = {};

  /* ── Chart color palette ── */
  const PALETTE = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981',
    '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4',
    '#84cc16', '#f97316'
  ];

  function isDark() { return document.body.classList.contains('dark'); }

  function chartDefaults() {
    return {
      font: { family: "'Inter', sans-serif" },
      color: isDark() ? '#94a3b8' : '#475569'
    };
  }

  /* ── Filter blank rows from API (allow ₹0 amounts) ── */
  function filterExpenses(arr) {
    return (arr || []).filter(e => e.amount !== '' && e.amount !== null && e.amount !== undefined && e.category && e.timestamp);
  }

  /* ── Render stats ── */
  function renderStats(dash) {
    const pct = dash.budgetPercent || 0;
    const pctClass = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'success';

    // Guard every element access — dashboard DOM may not be ready on first load
    const totalEl = el('dTotalSpent');
    if (totalEl) totalEl.textContent = fmtMoney(dash.totalSpent);

    const remainingEl = el('dRemaining');
    if (remainingEl) {
      remainingEl.textContent = fmtMoney(Math.max(0, dash.remaining));
      remainingEl.className = 'stat-value ' + pctClass;
    }

    const pctEl = el('dBudgetPct');
    if (pctEl) {
      pctEl.textContent = pct + '%';
      pctEl.className = 'budget-pct ' + pctClass;
    }

    const monthEl = el('dMonthLabel');
    if (monthEl) monthEl.textContent = formatMonth(dash.month);

    const limitEl = el('dLimitLabel');
    if (limitEl) limitEl.textContent = dash.monthlyLimit > 0
      ? `of ${fmtMoney(dash.monthlyLimit)} limit`
      : 'No limit set';

    const progressMax = el('dProgressMax');
    if (progressMax) progressMax.textContent = dash.monthlyLimit > 0 ? fmtMoney(dash.monthlyLimit) : '';

    const fill = el('dProgressFill');
    if (fill) {
      fill.style.width = Math.min(pct, 100) + '%';
      fill.className = 'progress-fill ' + (pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '');
    }
  }

  /* ── Category Pie Chart ── */
  function renderPieChart(categoryTotals) {
    const canvas = document.getElementById('catPieChart');
    if (!canvas) return;

    const labels = Object.keys(categoryTotals);
    const data   = labels.map(k => categoryTotals[k]);

    if (charts.pie) charts.pie.destroy();
    Chart.defaults.font.family = "'Inter', sans-serif";

    charts.pie = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: PALETTE.slice(0, labels.length),
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: chartDefaults().color,
              font: { family: "'Inter', sans-serif", weight: '600', size: 12 },
              padding: 14,
              usePointStyle: true,
              pointStyle: 'circle',
              pointStyleWidth: 8
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${fmtMoney(ctx.raw)} (${Math.round(ctx.raw / data.reduce((a,b)=>a+b,0)*100)}%)`
            }
          }
        }
      }
    });
  }

  /* ── Monthly Trend Combo Chart (Spend bars + Budget line) ── */
  function renderTrendChart(monthlyTrend, monthlyBudget) {
    const canvas = document.getElementById('trendLineChart');
    if (!canvas) return;

    // Clean: remove blank keys, sort chronologically
    const sorted = Object.entries(monthlyTrend)
      .filter(([k]) => k && k.match(/^\d{4}-\d{2}$/))
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6); // last 6 months

    const labels = sorted.map(([k]) => formatMonth(k));
    const spendData = sorted.map(([, v]) => Math.round(v));
    const budgetData = sorted.map(() => monthlyBudget || 0);

    if (charts.trend) charts.trend.destroy();

    const datasets = [{
      label: 'Spending',
      data: spendData,
      backgroundColor: PALETTE.slice(0, spendData.length).map(c => c + 'cc'),
      borderRadius: 8,
      borderSkipped: false,
      order: 2,
      type: 'bar'
    }];

    // Only add budget line if a budget is set
    if (monthlyBudget > 0) {
      datasets.push({
        label: 'Budget',
        data: budgetData,
        type: 'line',
        borderColor: '#ef4444',
        backgroundColor: '#ef4444',
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: '#ef4444',
        fill: false,
        tension: 0,
        order: 1
      });
    }

    charts.trend = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: chartDefaults().color, font: { size: 11, weight: '600', family: "'Inter', sans-serif" } }
          },
          y: {
            grid: { color: isDark() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
            ticks: {
              color: chartDefaults().color,
              font: { size: 11, family: "'Inter', sans-serif" },
              callback: v => fmtMoney(v)
            }
          }
        },
        plugins: {
          legend: {
            display: monthlyBudget > 0,
            position: 'top',
            labels: {
              color: chartDefaults().color,
              font: { family: "'Inter', sans-serif", size: 12 },
              usePointStyle: true,
              pointStyle: 'circle',
              pointStyleWidth: 10,
              generateLabels(chart) {
                // Ensure Spending legend item uses a filled circle (not a bar shape)
                return Chart.defaults.plugins.legend.labels.generateLabels(chart).map(item => {
                  item.pointStyle = 'circle';
                  return item;
                });
              }
            }
          },
          tooltip: { callbacks: { label: ctx => ' ' + fmtMoney(ctx.raw) } }
        }
      }
    });
  }

  /* ── Budget Overshoot Chart (categories over budget) ── */
  function renderOvershootChart(categoryTotals, categoryBudgets) {
    const card = document.getElementById('overshootChartCard');
    const canvas = document.getElementById('overshootBarChart');
    if (!canvas || !card) return;

    // Find categories that exceed their budget
    const overItems = Object.entries(categoryTotals)
      .map(([cat, spent]) => {
        const budget = (categoryBudgets || {})[cat] || 0;
        if (budget > 0 && spent > budget) {
          return { cat, spent, budget, over: spent - budget };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => b.over - a.over);

    if (!overItems.length) {
      card.style.display = 'none';
      if (charts.overshoot) { charts.overshoot.destroy(); charts.overshoot = null; }
      return;
    }

    card.style.display = '';
    const labels = overItems.map(i => i.cat);
    const data = overItems.map(i => Math.round(i.over));

    if (charts.overshoot) charts.overshoot.destroy();

    charts.overshoot = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Over Budget',
          data,
          backgroundColor: '#ef4444cc',
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        indexAxis: 'y',
        scales: {
          x: {
            grid: { color: isDark() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
            ticks: {
              color: chartDefaults().color,
              font: { size: 11, family: "'Inter', sans-serif" },
              callback: v => fmtMoney(v)
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: chartDefaults().color, font: { size: 12, weight: '600', family: "'Inter', sans-serif" } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const item = overItems[ctx.dataIndex];
                return ` Over by ${fmtMoney(ctx.raw)} (${fmtMoney(item.spent)} / ${fmtMoney(item.budget)})`;
              }
            }
          }
        }
      }
    });
  }

  /* ── Top Sources Bar Chart ── */
  function renderSourcesChart(sourceBreakdown) {
    const canvas = document.getElementById('sourcesBarChart');
    if (!canvas) return;

    // Filter blanks, sort by value, top 6
    const sorted = Object.entries(sourceBreakdown)
      .filter(([k, v]) => k && k !== 'Unknown' && v > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);

    const labels = sorted.map(([k]) => k);
    const data   = sorted.map(([, v]) => Math.round(v));

    if (charts.sources) charts.sources.destroy();

    charts.sources = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Amount',
          data,
          backgroundColor: PALETTE.slice(0, labels.length).map(c => c + 'cc'),
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        indexAxis: 'y',
        scales: {
          x: {
            grid: { color: isDark() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
            ticks: {
              color: chartDefaults().color,
              font: { size: 11, family: "'Inter', sans-serif" },
              callback: v => fmtMoney(v)
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: chartDefaults().color, font: { size: 12, weight: '600', family: "'Inter', sans-serif" } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + fmtMoney(ctx.raw) } }
        }
      }
    });
  }

  /* ── Per-Category Budget Bars ── */
  function renderCategoryBudgets(categoryTotals, categoryBudgets) {
    const container = document.getElementById('dCategoryBudgets');
    if (!container) return;

    const cats = Object.keys(categoryBudgets);
    if (!cats.length) {
      container.innerHTML = '<p style="color:var(--text-3);font-size:13px;text-align:center;padding:8px 0">No category budgets configured in Sheets.</p>';
      return;
    }

    // Sort categories: over-budget first, then by % used descending
    cats.sort((a, b) => {
      const pctA = categoryBudgets[a] > 0 ? (categoryTotals[a] || 0) / categoryBudgets[a] : 0;
      const pctB = categoryBudgets[b] > 0 ? (categoryTotals[b] || 0) / categoryBudgets[b] : 0;
      return pctB - pctA;
    });

    container.innerHTML = cats.map(cat => {
      const spent    = Math.round(categoryTotals[cat] || 0);
      const limit    = Math.round(categoryBudgets[cat] || 0);
      const pct      = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
      const over     = spent > limit && limit > 0;
      const barClass = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';

      return `
        <div class="cat-budget-row">
          <div class="cat-budget-header">
            <span class="cat-budget-name">${getCatIcon(cat)} ${escapeHtml(cat)}</span>
            <span class="cat-budget-amounts${over ? ' over' : ''}">${fmtMoney(spent)} / ${fmtMoney(limit)}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${barClass}" style="width:${pct}%"></div>
          </div>
          <div class="cat-budget-pct-row">
            <span class="cat-budget-pct ${barClass}">${pct}%${over ? ' over budget' : ''}</span>
            <span class="cat-budget-left">${over ? '' : fmtMoney(limit - spent) + ' left'}</span>
          </div>
        </div>`;
    }).join('');
  }

  /* ── Recent Expenses List ── */
  function renderRecent(expenses) {
    const list = document.getElementById('dRecentList');
    if (!list) return;

    // Slice to 20 for the recent list display even though analytics provides up to 200
    const clean = filterExpenses(expenses).slice(0, 20);

    if (!clean.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No expenses yet this month.</p>
        </div>`;
      return;
    }

    list.innerHTML = clean.map(e => `
      <div class="expense-item">
        <div class="expense-icon ${getCatClass(e.category)}">${getCatIcon(e.category)}</div>
        <div class="expense-info">
          <div class="expense-category">${escapeHtml(e.category)}</div>
          <div class="expense-source">${escapeHtml(e.source || e.paymentMode || '—')}</div>
        </div>
        <div class="expense-meta">
          <div class="expense-amount">${fmtMoney(e.amount)}</div>
          <div class="expense-time">${fmtDate(e.timestamp)}</div>
        </div>
      </div>
    `).join('');
  }

  /* ── Cache age bar ── */
  function updateCacheBar(ageMs) {
    const bar = document.getElementById('dashCacheBar');
    const lbl = document.getElementById('dashCacheAge');
    if (!bar || !lbl) return;

    if (ageMs === null || ageMs < 30_000) {
      // Fresh fetch — hide the bar
      bar.style.display = 'none';
      return;
    }

    const mins = Math.round(ageMs / 60_000);
    lbl.textContent = '🕐 Updated ' + (mins < 1 ? 'just now' : mins + ' min' + (mins === 1 ? '' : 's') + ' ago');
    bar.style.display = 'flex';
  }

  /* ── Loading state ── */
  function setLoading(state) {
    const spinner = document.getElementById('dashLoadingState');
    const content = document.getElementById('dashContent');
    if (spinner) spinner.style.display = state ? 'flex' : 'none';
    if (content) content.style.display = state ? 'none' : 'block';
  }

  /* ── Public load ── */
  async function load() {
    setLoading(true);
    try {
      // Check if we are serving from cache so we can show the cache bar
      const dashAge     = ApiCache.getAge('dashboard');
      const analyticsAge = ApiCache.getAge('analytics');

      const [dash, analytics] = await Promise.all([
        API.fetchDashboard(),
        API.fetchAnalytics()
      ]);

      // Use the older of the two ages (both must be fresh for the bar to be hidden)
      const ageMs = (dashAge !== null && analyticsAge !== null)
        ? Math.max(dashAge, analyticsAge)
        : null;
      updateCacheBar(ageMs);

      renderStats(dash);
      renderPieChart(dash.categoryTotals || {});
      renderOvershootChart(dash.categoryTotals || {}, dash.categoryBudgets || {});
      renderTrendChart(analytics.monthlyTrend || {}, analytics.monthlyBudget || dash.monthlyLimit || 0);
      renderCategoryBudgets(dash.categoryTotals || {}, dash.categoryBudgets || {});
      renderSourcesChart(analytics.sourceBreakdown || {});
      renderRecent(analytics.recentExpenses || []);

      loaded = true;
    } catch (e) {
      const content = document.getElementById('dashContent');
      if (content) content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <p>${escapeHtml(e.message)}</p>
        </div>`;
    } finally {
      setLoading(false);
    }
  }

  /* ── Wire refresh button ── */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('dashRefreshBtn')?.addEventListener('click', () => {
      ApiCache.invalidate('dashboard', 'analytics');
      load();
    });
  });

  /* ── Helpers ── */
  function el(id) { return document.getElementById(id); }

  function formatMonth(ym) {
    if (!ym || !ym.match(/^\d{4}-\d{2}$/)) return ym || '';
    const [y, m] = ym.split('-');
    return new Date(y, m - 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  }

  return { load };

})();
