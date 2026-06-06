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

  /* ── Filter blank rows from API ── */
  function filterExpenses(arr) {
    return (arr || []).filter(e => e.amount && e.category && e.timestamp);
  }

  /* ── Render stats ── */
  function renderStats(dash) {
    const pct = dash.budgetPercent || 0;
    const pctClass = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'success';

    el('dTotalSpent').textContent  = fmtMoney(dash.totalSpent);
    el('dRemaining').textContent   = fmtMoney(Math.max(0, dash.remaining));
    el('dBudgetPct').textContent   = pct + '%';
    el('dMonthLabel').textContent  = formatMonth(dash.month);
    el('dLimitLabel').textContent  = dash.monthlyLimit > 0
      ? `of ${fmtMoney(dash.monthlyLimit)} limit`
      : 'No limit set';

    const fill = el('dProgressFill');
    if (fill) {
      fill.style.width = Math.min(pct, 100) + '%';
      fill.className = 'progress-fill ' + (pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '');
    }

    el('dBudgetPct').className = 'budget-pct ' + pctClass;

    const remaining = el('dRemaining');
    if (remaining) remaining.className = 'stat-value ' + pctClass;
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

  /* ── Monthly Trend Line Chart ── */
  function renderTrendChart(monthlyTrend) {
    const canvas = document.getElementById('trendLineChart');
    if (!canvas) return;

    // Clean: remove blank keys, sort chronologically
    const sorted = Object.entries(monthlyTrend)
      .filter(([k]) => k && k.match(/^\d{4}-\d{2}$/))
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6); // last 6 months

    const labels = sorted.map(([k]) => formatMonth(k));
    const data   = sorted.map(([, v]) => Math.round(v));

    if (charts.trend) charts.trend.destroy();

    charts.trend = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Spending',
          data,
          borderColor: '#6366f1',
          backgroundColor: isDark()
            ? 'rgba(99,102,241,0.15)'
            : 'rgba(99,102,241,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: isDark() ? '#111827' : '#fff',
          pointBorderWidth: 2
        }]
      },
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
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + fmtMoney(ctx.raw) } }
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

  /* ── Recent Expenses List ── */
  function renderRecent(expenses) {
    const list = document.getElementById('dRecentList');
    if (!list) return;

    const clean = filterExpenses(expenses);

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
          <div class="expense-category">${e.category}</div>
          <div class="expense-source">${e.source || e.paymentMode || '—'}</div>
        </div>
        <div class="expense-meta">
          <div class="expense-amount">${fmtMoney(e.amount)}</div>
          <div class="expense-time">${fmtDate(e.timestamp)}</div>
        </div>
      </div>
    `).join('');
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
      const [dash, recent, analytics] = await Promise.all([
        API.fetchDashboard(),
        API.fetchRecent(),
        API.fetchAnalytics()
      ]);

      renderStats(dash);
      renderPieChart(dash.categoryTotals || {});
      renderTrendChart(analytics.monthlyTrend || {});
      renderSourcesChart(analytics.sourceBreakdown || {});
      renderRecent(recent);

      loaded = true;
    } catch (e) {
      const content = document.getElementById('dashContent');
      if (content) content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <p>${e.message}</p>
        </div>`;
    } finally {
      setLoading(false);
    }
  }

  /* ── Helpers ── */
  function el(id) { return document.getElementById(id); }

  function formatMonth(ym) {
    if (!ym || !ym.match(/^\d{4}-\d{2}$/)) return ym || '';
    const [y, m] = ym.split('-');
    return new Date(y, m - 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  }

  return { load };

})();
