/**
 * HIGHWAYPULSE — OVERVIEW DASHBOARD MODULE (js/dashboard.js)

 * PURPOSE & UI RESPONSIBILITY:
 * This file powers the executive and operations landing page (#view-overview).
 * It aggregates defect and maintenance statistics into real-time KPI metrics,
 * interactive Chart.js visualizations (with CSS fallbacks), and live critical
 * triage alerts.
 *
 * KEY FEATURES IMPLEMENTED IN THIS FILE:
 * 1. Live Key Performance Indicators (KPIs):
 *    - Total Defects registered across network.
 *    - Open Defects awaiting maintenance scheduling.
 *    - Critical Safety Hazards (Heuristic Priority Score >= 80).
 *    - Resolved Defects percentage and absolute counts.
 *    - Network Average Priority Score.
 *    - Overdue Maintenance Tasks tracking against target completion dates.
 * 2. Interactive Chart.js Visualizations (with resilient HTML/CSS fallbacks):
 *    - Defect Priority Distribution (Bar Chart by classification tier).
 *    - Defect Category Breakdown (Doughnut Chart of structural failure types).
 *    - Monthly Defect Inflow Trend (Line Chart showing monthly registration history).
 *    - Resolution Workflow Status (Horizontal Bar Chart tracking repair lifecycle).
 * 3. Critical Safety Hazards Triage Banner:
 *    - Immediately highlights severe defects (score >= 80) requiring urgent action.
 *    - One-click navigation to inspect details and plan rapid response.
 * 4. Recent Inspection Reports Feed:
 *    - Displays latest 5 logged observations with quick status badges.
 * 5. Interactive KPI Card Filtering:
 *    - Clicking any KPI card (e.g. Critical Defects, Open Defects) routes to the
 *      Defects table with the corresponding filter pre-applied.
 *
 * HOW TO STUDY THIS FILE:
 * - Study `getKPIs()` to see how pure JavaScript array methods (`reduce`, `filter`)
 *   calculate summary metrics from LocalStorage data.
 * - Examine `renderCharts()` to understand how Chart.js is instantiated with
 *   light/dark theme palette awareness and how try/catch provides fallback HTML bars.
 * - Inspect `setupEventListeners()` for delegate routing between summary cards
 *   and detailed table views.
 *
 * DEPENDENCIES:
 * - js/utils.js: For `Utils.formatNumber()`, `Utils.escapeHtml()`, and date formatting.
 * - js/storage.js: For `StorageService.getDefects()` and `StorageService.getTasks()`.
 * - js/priority.js: For `PrioritySystem.getBadgeHtml()`.
 * - js/defects.js: For navigating and pre-filtering the Defect Management table.
 */

const DashboardModule = {
  charts: {
    priority: null,
    category: null,
    trend: null,
    status: null,
  },

  /**
   * Initialize and render the overview dashboard
   */
  init() {
    this.renderKPIs();
    this.renderCharts();
    this.renderRecentDefects();
    this.renderCriticalAlerts();
    this.setupEventListeners();
  },

  /**
   * Calculate live KPIs from storage
   */
  getKPIs() {
    const defects = StorageService.getDefects();
    const tasks = StorageService.getTasks();
    const today = new Date().toISOString().split('T')[0];

    const totalDefects = defects.length;
    const openDefects = defects.filter(d => d.status === 'Open').length;
    const criticalDefects = defects.filter(d => d.priority === 'Critical').length;
    const resolvedDefects = defects.filter(d => d.status === 'Resolved').length;

    const totalScore = defects.reduce((sum, d) => sum + (d.priorityScore || 0), 0);
    const avgScore = totalDefects > 0 ? (totalScore / totalDefects).toFixed(1) : '0';

    // Overdue tasks: target date is before today and status is not 'Completed'
    const overdueTasks = tasks.filter(t => {
      return t.targetCompletionDate && t.targetCompletionDate < today && t.status !== 'Completed';
    }).length;

    return {
      totalDefects,
      openDefects,
      criticalDefects,
      resolvedDefects,
      avgScore,
      overdueTasks,
    };
  },

  /**
   * Render the 6 KPI metric cards
   */
  renderKPIs() {
    const kpis = this.getKPIs();

    const container = document.getElementById('dashboard-kpis');
    if (!container) return;

    container.innerHTML = `
      <div class="kpi-card" data-filter-type="all" tabindex="0" role="button" aria-label="View all defects">
        <div class="kpi-icon kpi-blue">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">Total Defects</div>
          <div class="kpi-value">${Utils.formatNumber(kpis.totalDefects)}</div>
          <div class="kpi-subtext">Registered across network</div>
        </div>
      </div>

      <div class="kpi-card" data-filter-type="status" data-filter-val="Open" tabindex="0" role="button" aria-label="Filter open defects">
        <div class="kpi-icon kpi-amber">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">Open Defects</div>
          <div class="kpi-value">${Utils.formatNumber(kpis.openDefects)}</div>
          <div class="kpi-subtext">Awaiting maintenance plan</div>
        </div>
      </div>

      <div class="kpi-card" data-filter-type="priority" data-filter-val="Critical" tabindex="0" role="button" aria-label="Filter critical defects">
        <div class="kpi-icon kpi-red">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">Critical Defects</div>
          <div class="kpi-value text-red">${Utils.formatNumber(kpis.criticalDefects)}</div>
          <div class="kpi-subtext">Score ≥ 80 (Safety hazard)</div>
        </div>
      </div>

      <div class="kpi-card" data-filter-type="status" data-filter-val="Resolved" tabindex="0" role="button" aria-label="Filter resolved defects">
        <div class="kpi-icon kpi-green">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">Resolved Defects</div>
          <div class="kpi-value text-green">${Utils.formatNumber(kpis.resolvedDefects)}</div>
          <div class="kpi-subtext">${kpis.totalDefects ? Math.round((kpis.resolvedDefects / kpis.totalDefects) * 100) : 0}% network resolution rate</div>
        </div>
      </div>

      <div class="kpi-card" data-filter-type="all" tabindex="0" role="button" aria-label="Average priority index">
        <div class="kpi-icon kpi-purple">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">Average Score</div>
          <div class="kpi-value">${kpis.avgScore} <span class="text-sm text-muted">/ 100</span></div>
          <div class="kpi-subtext">Composite heuristic index</div>
        </div>
      </div>

      <div class="kpi-card" data-navigate="planner" data-planner-filter="overdue" tabindex="0" role="button" aria-label="View overdue planner tasks">
        <div class="kpi-icon kpi-orange">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><line x1="10" y1="14" x2="14" y2="18"></line><line x1="14" y1="14" x2="10" y2="18"></line></svg>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">Overdue Tasks</div>
          <div class="kpi-value ${kpis.overdueTasks > 0 ? 'text-red' : ''}">${Utils.formatNumber(kpis.overdueTasks)}</div>
          <div class="kpi-subtext">Past target completion date</div>
        </div>
      </div>
    `;

    // Update top navbar alert badge count
    const alertCountEl = document.getElementById('topbar-alert-count');
    if (alertCountEl) {
      const urgentCount = kpis.criticalDefects + kpis.overdueTasks;
      alertCountEl.textContent = urgentCount;
      alertCountEl.style.display = urgentCount > 0 ? 'inline-flex' : 'none';
    }
  },

  /**
   * Render Chart.js charts with fallback
   */
  renderCharts() {
    const defects = StorageService.getDefects();

    // 1. Priority Breakdown
    this.renderPriorityChart(defects);

    // 2. Category Distribution
    this.renderCategoryChart(defects);

    // 3. Reporting Trend
    this.renderTrendChart(defects);

    // 4. Status Distribution
    this.renderStatusChart(defects);
  },

  renderPriorityChart(defects) {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    defects.forEach(d => {
      const p = d.priority || 'Low';
      if (counts[p] !== undefined) counts[p]++;
      else counts.Low++;
    });

    const canvas = document.getElementById('chart-priority');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
      this.renderFallbackChart(canvas.parentElement, 'Priority Distribution', counts);
      return;
    }

    if (this.charts.priority) this.charts.priority.destroy();

    const isDark = document.documentElement.classList.contains('dark-theme');
    const textColor = isDark ? '#94a3b8' : '#475569';

    this.charts.priority = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Critical (80-100)', 'High (60-79)', 'Medium (35-59)', 'Low (0-34)'],
        datasets: [{
          data: [counts.Critical, counts.High, counts.Medium, counts.Low],
          backgroundColor: ['#dc2626', '#ea580c', '#3b82f6', '#64748b'],
          borderWidth: 2,
          borderColor: isDark ? '#1e293b' : '#ffffff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, boxWidth: 12, padding: 12, font: { family: 'inherit', size: 12 } }
          }
        },
        cutout: '65%'
      }
    });
  },

  renderCategoryChart(defects) {
    const catCounts = {};
    defects.forEach(d => {
      const cat = d.category || 'Other';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    const labels = Object.keys(catCounts);
    const data = Object.values(catCounts);

    const canvas = document.getElementById('chart-category');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
      this.renderFallbackChart(canvas.parentElement, 'Categories', catCounts);
      return;
    }

    if (this.charts.category) this.charts.category.destroy();

    const isDark = document.documentElement.classList.contains('dark-theme');
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    this.charts.category = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels.map(l => Utils.truncate(l, 14)),
        datasets: [{
          label: 'Defects',
          data: data,
          backgroundColor: '#2563eb',
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: textColor, precision: 0 },
            grid: { color: gridColor }
          },
          y: {
            ticks: { color: textColor, font: { size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  },

  renderTrendChart(defects) {
    // Group defects by Month-Year
    const monthCounts = {};
    defects.forEach(d => {
      if (d.reportedDate) {
        const parts = d.reportedDate.split('-');
        if (parts.length >= 2) {
          const key = `${parts[0]}-${parts[1]}`;
          monthCounts[key] = (monthCounts[key] || 0) + 1;
        }
      }
    });

    const sortedMonths = Object.keys(monthCounts).sort();
    const formattedLabels = sortedMonths.map(m => {
      const [y, mo] = m.split('-');
      const d = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });
    const data = sortedMonths.map(m => monthCounts[m]);

    const canvas = document.getElementById('chart-trend');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
      this.renderFallbackChart(canvas.parentElement, 'Monthly Trend', monthCounts);
      return;
    }

    if (this.charts.trend) this.charts.trend.destroy();

    const isDark = document.documentElement.classList.contains('dark-theme');
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    this.charts.trend = new Chart(canvas, {
      type: 'line',
      data: {
        labels: formattedLabels,
        datasets: [{
          label: 'Defects Logged',
          data: data,
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#0284c7',
          pointRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: textColor },
            grid: { color: gridColor }
          },
          y: {
            ticks: { color: textColor, precision: 0 },
            grid: { color: gridColor }
          }
        }
      }
    });
  },

  renderStatusChart(defects) {
    const statusCounts = { 'Open': 0, 'Under Review': 0, 'In Progress': 0, 'Resolved': 0 };
    defects.forEach(d => {
      const s = d.status || 'Open';
      if (statusCounts[s] !== undefined) statusCounts[s]++;
      else statusCounts['Open']++;
    });

    const canvas = document.getElementById('chart-status');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
      this.renderFallbackChart(canvas.parentElement, 'Status Breakdown', statusCounts);
      return;
    }

    if (this.charts.status) this.charts.status.destroy();

    const isDark = document.documentElement.classList.contains('dark-theme');
    const textColor = isDark ? '#94a3b8' : '#475569';

    this.charts.status = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Open', 'Under Review', 'In Progress', 'Resolved'],
        datasets: [{
          data: [statusCounts['Open'], statusCounts['Under Review'], statusCounts['In Progress'], statusCounts['Resolved']],
          backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
          borderWidth: 2,
          borderColor: isDark ? '#1e293b' : '#ffffff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, boxWidth: 12, padding: 12, font: { family: 'inherit', size: 12 } }
          }
        },
        cutout: '60%'
      }
    });
  },

  /**
   * Accessible fallback when Chart.js CDN is unavailable
   */
  renderFallbackChart(container, title, dataObj) {
    if (!container) return;
    const items = Object.entries(dataObj);
    const total = items.reduce((sum, [, val]) => sum + val, 0);

    let html = `
      <div class="chart-fallback">
        <p class="text-sm text-muted mb-2"><em>Chart library offline. Displaying text breakdown:</em></p>
        <ul class="fallback-list">
    `;

    items.forEach(([label, count]) => {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      html += `
        <li class="fallback-item">
          <div class="fallback-label">${Utils.escapeHtml(label)}</div>
          <div class="fallback-bar-wrap">
            <div class="fallback-bar" style="width: ${pct}%"></div>
          </div>
          <div class="fallback-val">${count} (${pct}%)</div>
        </li>
      `;
    });

    html += `</ul></div>`;
    container.innerHTML = html;
  },

  /**
   * Render Recent Defects table in overview
   */
  renderRecentDefects() {
    const defects = StorageService.getDefects();
    const sorted = [...defects].sort((a, b) => new Date(b.reportedDate) - new Date(a.reportedDate));
    const recent = sorted.slice(0, 5);

    const tbody = document.getElementById('recent-defects-body');
    if (!tbody) return;

    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No defect records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = recent.map(defect => `
      <tr>
        <td><strong>${Utils.escapeHtml(defect.id)}</strong></td>
        <td>
          <div class="font-medium">${Utils.escapeHtml(defect.road)}</div>
          <div class="text-xs text-muted">${Utils.escapeHtml(defect.location)}</div>
        </td>
        <td>${Utils.escapeHtml(defect.category)}</td>
        <td>${PrioritySystem.renderBadge(defect.priority, defect.priorityScore)}</td>
        <td>${Utils.formatDate(defect.reportedDate)}</td>
        <td>${PrioritySystem.renderStatusBadge(defect.status)}</td>
        <td>
          <button class="btn btn-sm btn-outline btn-view-defect" data-id="${Utils.escapeHtml(defect.id)}">
            Inspect
          </button>
        </td>
      </tr>
    `).join('');
  },

  /**
   * Render Critical Alerts section for immediate intervention
   */
  renderCriticalAlerts() {
    const defects = StorageService.getDefects();
    const critical = defects.filter(d => d.priority === 'Critical' && d.status !== 'Resolved');

    const container = document.getElementById('critical-alerts-container');
    if (!container) return;

    if (critical.length === 0) {
      container.innerHTML = `
        <div class="alert-box alert-success">
          <span class="alert-icon">✓</span>
          <div>
            <strong>No unaddressed critical defects detected.</strong>
            <p class="text-xs">All high-safety hazards currently have work underway or have been successfully resolved.</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="critical-notice-banner">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-red font-bold">⚠ HIGHWAY SAFETY ACTION REQUIRED</span>
          <span class="badge badge-critical">${critical.length} Active Hazard${critical.length > 1 ? 's' : ''}</span>
        </div>
        <p class="text-xs text-muted mt-1">
          The following defects exceed Priority Score 80 with high severity and traffic exposure. Immediate maintenance coordination is recommended.
        </p>
      </div>
      <div class="critical-cards-grid">
        ${critical.slice(0, 4).map(d => `
          <div class="critical-card">
            <div class="flex justify-between items-start mb-1 flex-wrap gap-1">
              <span class="font-bold text-sm text-red">${Utils.escapeHtml(d.id)}</span>
              ${PrioritySystem.renderBadge(d.priority, d.priorityScore)}
            </div>
            <div class="font-medium text-sm break-words">${Utils.escapeHtml(d.road)}</div>
            <div class="text-xs text-muted mb-2 break-words">${Utils.escapeHtml(d.location)}</div>
            <div class="text-xs line-clamp-2 mb-2 text-slate break-words">${Utils.escapeHtml(d.description)}</div>
            <div class="flex justify-between items-center pt-2 border-t text-xs flex-wrap gap-2">
              <span class="text-muted">Assigned: ${Utils.escapeHtml(d.assignedTeam || 'Unassigned')}</span>
              <button class="btn btn-xs btn-primary btn-view-defect" data-id="${Utils.escapeHtml(d.id)}">
                View & Plan
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  /**
   * Attach card clicks and event listeners
   */
  setupEventListeners() {
    // KPI Card navigation clicks
    const kpiCards = document.querySelectorAll('.kpi-card');
    kpiCards.forEach(card => {
      card.addEventListener('click', () => {
        const nav = card.getAttribute('data-navigate');
        if (nav === 'planner') {
          App.navigateTo('planner');
          return;
        }

        const filterType = card.getAttribute('data-filter-type');
        const filterVal = card.getAttribute('data-filter-val');

        App.navigateTo('defects');
        if (filterType === 'priority' && filterVal) {
          DefectsModule.setFilter('priority', filterVal);
        } else if (filterType === 'status' && filterVal) {
          DefectsModule.setFilter('status', filterVal);
        } else {
          DefectsModule.resetFilters();
        }
      });
    });

    // Inspect buttons
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-view-defect');
      if (btn) {
        const id = btn.getAttribute('data-id');
        if (id) DefectsModule.openDetailModal(id);
      }
    });
  }
};
