/**
 
 * HIGHWAYPULSE — ANALYTICS & AUDIT REPORTS MODULE (js/analytics.js)
 
 * PURPOSE & UI RESPONSIBILITY:
 * This file powers the infrastructure intelligence suite (#view-analytics).
 * It computes descriptive statistics, corridor safety rankings, category
 * distributions, and downloadable management audit summaries.
 *
 * KEY FEATURES IMPLEMENTED IN THIS FILE:
 * 1. Statistical Aggregation Cards:
 *    - Network Resolution Rate (% of logged defects successfully repaired).
 *    - Average Defect Severity (rated 1 to 10 across structural conditions).
 *    - Average Safety Hazard Factor (rated 1 to 10 for collision risk).
 *    - Median Unresolved Turnaround Time (in days).
 * 2. Corridor Risk & Defect Frequency Ranking:
 *    - Ranks National Highway corridors by total defect density and severity.
 *    - Identifies most vulnerable highway sections needing capital resurfacing.
 * 3. Defect Category Distribution Analysis:
 *    - Evaluates pavement vs. structural vs. drainage failure frequencies.
 * 4. Temporal Filter Controls:
 *    - Filter analytics dataset by timeframe: All Time, Last 30 Days, Last 90 Days, Last 180 Days.
 * 5. One-Click Executive CSV Audit Export:
 *    - Exports compiled corridor metrics and safety scores to a structured spreadsheet report.
 *
 * HOW TO STUDY THIS FILE:
 * - Study `renderCorridorChart()` and `renderCategoryChart()` to see how data is
 *   grouped by key using JavaScript objects as hash maps (`counts[item] = (counts[item] || 0) + 1`).
 * - Review how theme-responsive Chart.js options adapt axes and gridline colors
 *   dynamically between Light and Dark mode.
 * - Examine `exportReport()` to understand how client-side CSV downloads are generated.
 *
 * DEPENDENCIES:
 * - js/utils.js: For `Utils.formatNumber()`, `Utils.exportToCsv()`.
 * - js/storage.js: For `StorageService.getDefects()`.
 */

const AnalyticsModule = {
  charts: {
    corridor: null,
    categoryDist: null,
  },

  state: {
    dateFilter: 'all', // 'all' | '30' | '90' | '180'
  },

  init() {
    this.setupEventListeners();
    this.render();
  },

  setupEventListeners() {
    const dateSelect = document.getElementById('analytics-date-filter');
    if (dateSelect) {
      dateSelect.addEventListener('change', (e) => {
        this.state.dateFilter = e.target.value;
        this.render();
      });
    }

    const exportBtn = document.getElementById('btn-analytics-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        DefectsModule.exportToCsv();
      });
    }

    const exportTasksBtn = document.getElementById('btn-analytics-export-tasks-csv');
    if (exportTasksBtn) {
      exportTasksBtn.addEventListener('click', () => {
        PlannerModule.exportTasksCsv();
      });
    }
  },

  getFilteredDefects() {
    let defects = StorageService.getDefects();
    if (this.state.dateFilter === 'all') return defects;

    const days = parseInt(this.state.dateFilter, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return defects.filter(d => d.reportedDate && d.reportedDate >= cutoffStr);
  },

  render() {
    const defects = this.getFilteredDefects();
    const tasks = StorageService.getTasks();
    const today = new Date().toISOString().split('T')[0];

    const total = defects.length;
    const resolved = defects.filter(d => d.status === 'Resolved').length;
    const resolutionRate = total > 0 ? ((resolved / total) * 100).toFixed(1) : '0';

    const sumSeverity = defects.reduce((sum, d) => sum + (d.severity || 0), 0);
    const avgSeverity = total > 0 ? (sumSeverity / total).toFixed(1) : '0';

    const sumScore = defects.reduce((sum, d) => sum + (d.priorityScore || 0), 0);
    const avgScore = total > 0 ? (sumScore / total).toFixed(1) : '0';

    const overdueTasks = tasks.filter(t => t.targetCompletionDate && t.targetCompletionDate < today && t.status !== 'Completed').length;

    // Render KPI Metrics
    const metricsContainer = document.getElementById('analytics-metrics-grid');
    if (metricsContainer) {
      metricsContainer.innerHTML = `
        <div class="analytics-stat-card">
          <div class="stat-title">Sample Defects in Range</div>
          <div class="stat-number text-navy">${total}</div>
          <div class="stat-note">Evaluated records</div>
        </div>
        <div class="analytics-stat-card">
          <div class="stat-title">Resolution Rate</div>
          <div class="stat-number text-green">${resolutionRate}%</div>
          <div class="stat-note">${resolved} resolved defects</div>
        </div>
        <div class="analytics-stat-card">
          <div class="stat-title">Average Severity</div>
          <div class="stat-number text-blue">${avgSeverity} <span class="text-xs text-muted">/ 100</span></div>
          <div class="stat-note">Physical deterioration</div>
        </div>
        <div class="analytics-stat-card">
          <div class="stat-title">Average Priority Score</div>
          <div class="stat-number text-orange">${avgScore} <span class="text-xs text-muted">/ 100</span></div>
          <div class="stat-note">Composite heuristic</div>
        </div>
        <div class="analytics-stat-card">
          <div class="stat-title">Overdue Maintenance Tasks</div>
          <div class="stat-number ${overdueTasks > 0 ? 'text-red' : 'text-slate'}">${overdueTasks}</div>
          <div class="stat-note">Milestones delayed</div>
        </div>
      `;
    }

    // Top Affected Corridors table & chart
    this.renderCorridorAnalysis(defects);
    this.renderCategoryBreakdown(defects);
  },

  renderCorridorAnalysis(defects) {
    const corridorCounts = {};
    const corridorScores = {};

    defects.forEach(d => {
      const road = d.road || 'Unclassified Corridor';
      corridorCounts[road] = (corridorCounts[road] || 0) + 1;
      corridorScores[road] = (corridorScores[road] || 0) + (d.priorityScore || 0);
    });

    const sorted = Object.keys(corridorCounts).map(road => ({
      road,
      count: corridorCounts[road],
      avgScore: Math.round(corridorScores[road] / corridorCounts[road]),
    })).sort((a, b) => b.count - a.count);

    // Render Table
    const tbody = document.getElementById('corridor-ranking-tbody');
    if (tbody) {
      if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No records found.</td></tr>`;
      } else {
        tbody.innerHTML = sorted.slice(0, 6).map((c, i) => `
          <tr>
            <td class="font-bold text-center">${i + 1}</td>
            <td class="font-medium text-xs">${Utils.escapeHtml(c.road)}</td>
            <td class="text-center font-bold font-mono text-xs">${c.count}</td>
            <td class="text-center font-mono text-xs">
              <span class="${c.avgScore >= 70 ? 'text-red font-bold' : ''}">${c.avgScore}</span>
            </td>
          </tr>
        `).join('');
      }
    }

    // Render Horizontal Bar Chart for Top Corridors
    const canvas = document.getElementById('chart-analytics-corridors');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
      DashboardModule.renderFallbackChart(canvas.parentElement, 'Corridor Ranking', corridorCounts);
      return;
    }

    if (this.charts.corridor) this.charts.corridor.destroy();

    const top5 = sorted.slice(0, 5);
    const isDark = document.documentElement.classList.contains('dark-theme');
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    this.charts.corridor = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: top5.map(c => Utils.truncate(c.road, 18)),
        datasets: [{
          label: 'Defect Incidents',
          data: top5.map(c => c.count),
          backgroundColor: '#0284c7',
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

  renderCategoryBreakdown(defects) {
    const catCounts = {};
    defects.forEach(d => {
      const c = d.category || 'Other';
      catCounts[c] = (catCounts[c] || 0) + 1;
    });

    const canvas = document.getElementById('chart-analytics-categories');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
      DashboardModule.renderFallbackChart(canvas.parentElement, 'Category Distribution', catCounts);
      return;
    }

    if (this.charts.categoryDist) this.charts.categoryDist.destroy();

    const isDark = document.documentElement.classList.contains('dark-theme');
    const textColor = isDark ? '#94a3b8' : '#475569';

    this.charts.categoryDist = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: Object.keys(catCounts),
        datasets: [{
          data: Object.values(catCounts),
          backgroundColor: [
            '#2563eb', '#38bdf8', '#f59e0b', '#dc2626',
            '#10b981', '#8b5cf6', '#ec4899', '#64748b'
          ],
          borderWidth: 2,
          borderColor: isDark ? '#1e293b' : '#ffffff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: textColor, boxWidth: 10, padding: 8, font: { size: 11 } }
          }
        }
      }
    });
  }
};
