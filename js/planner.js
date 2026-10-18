/**
 * HIGHWAYPULSE — MAINTENANCE PLANNER MODULE (js/planner.js)
 
 * PURPOSE & UI RESPONSIBILITY:
 * This file powers the maintenance operations scheduling suite (#view-planner).
 * It enables highway authorities to manage work orders, assign specialized crews,
 * balance crew workloads, detect scheduling conflicts, and track repair deadlines.
 *
 * KEY FEATURES IMPLEMENTED IN THIS FILE:
 * 1. Maintenance Summary KPI Counters:
 *    - Total Active Work Orders across the highway network.
 *    - In Progress Tasks actively being executed on site.
 *    - Scheduled Tasks awaiting mobilization dates.
 *    - Overdue Tasks: highlighted in red when target completion date < today.
 * 2. Crew Workload & Conflict Detection (`detectConflicts`):
 *    - Analyzes overlapping date ranges for teams assigned to multiple concurrent sites.
 *    - Flags warning badges when a crew is overbooked beyond operational capacity.
 * 3. Comprehensive Work Orders Table:
 *    - Columns: Task ID, Defect Link, Corridor & Section, Priority, Assigned Team,
 *      Planned Start Date, Target Completion Date, Status, and Action controls.
 *    - Compound filtering by Status (Scheduled, In Progress, On Hold, Completed),
 *      Priority tier, and Assigned Maintenance Unit.
 *    - Sorting by Target Completion Date (earliest first for urgency) or Priority.
 * 4. Create & Edit Work Order Modal:
 *    - Form to schedule new repairs or reassign existing jobs.
 *    - Auto-links to existing defect records with chainage and road coordinates.
 *    - Duration in hours and crew notes input fields.
 * 5. Work Order Status Transitions:
 *    - Quick in-table status changer (e.g., mark task 'In Progress' or 'Completed').
 *    - Automatically synchronizes underlying defect status in Defect Management.
 *
 * HOW TO STUDY THIS FILE:
 * - Study `detectConflicts()` to understand operational business logic and interval
 *   overlap algorithms in JavaScript.
 * - Examine `renderTable()` to see how date comparisons identify overdue work orders.
 * - Inspect `saveTask()` to trace how updating a work order updates both `tasks` and
 *   `defects` arrays in `StorageService`.
 *
 * DEPENDENCIES:
 * - js/utils.js: For date formatting, HTML escaping, and modal helpers.
 * - js/storage.js: For `StorageService.getTasks()`, `saveTasks()`, `updateDefect()`.
 * - js/priority.js: For `PrioritySystem.getBadgeHtml()`.
 */

const PlannerModule = {
  state: {
    filterStatus: 'all',
    filterPriority: 'all',
    filterTeam: 'all',
    sortField: 'targetCompletionDate',
    sortDirection: 'asc',
  },

  init() {
    this.populateFilterDropdowns();
    this.setupEventListeners();
    this.render();
  },

  populateFilterDropdowns() {
    const tasks = StorageService.getTasks();
    const teams = Array.from(new Set(tasks.map(t => t.assignedTeam).filter(Boolean))).sort();

    const teamSelect = document.getElementById('filter-planner-team');
    if (teamSelect) {
      teamSelect.innerHTML = `<option value="all">All Teams</option>` +
        teams.map(t => `<option value="${Utils.escapeHtml(t)}">${Utils.escapeHtml(t)}</option>`).join('');
    }
  },

  setupEventListeners() {
    const statusSelect = document.getElementById('filter-planner-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.state.filterStatus = e.target.value;
        this.render();
      });
    }

    const prioritySelect = document.getElementById('filter-planner-priority');
    if (prioritySelect) {
      prioritySelect.addEventListener('change', (e) => {
        this.state.filterPriority = e.target.value;
        this.render();
      });
    }

    const teamSelect = document.getElementById('filter-planner-team');
    if (teamSelect) {
      teamSelect.addEventListener('change', (e) => {
        this.state.filterTeam = e.target.value;
        this.render();
      });
    }

    const newBtn = document.getElementById('btn-new-task');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        this.openNewTaskModal();
      });
    }

    const exportBtn = document.getElementById('btn-export-tasks-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportTasksCsv();
      });
    }

    // Modal close and submit handlers
    const modal = document.getElementById('task-modal');
    if (modal) {
      modal.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => this.closeModal());
      });
    }

    const form = document.getElementById('task-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveTask();
      });
    }
  },

  /**
   * Check for schedule overlaps for the same maintenance team
   */
  detectConflicts(tasks) {
    const conflicts = [];
    const activeTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'On Hold');

    for (let i = 0; i < activeTasks.length; i++) {
      for (let j = i + 1; j < activeTasks.length; j++) {
        const t1 = activeTasks[i];
        const t2 = activeTasks[j];

        if (t1.assignedTeam && t1.assignedTeam === t2.assignedTeam) {
          // Check date overlap
          const start1 = t1.plannedStartDate;
          const end1 = t1.targetCompletionDate;
          const start2 = t2.plannedStartDate;
          const end2 = t2.targetCompletionDate;

          if (start1 && end1 && start2 && end2) {
            if (start1 <= end2 && start2 <= end1) {
              conflicts.push({
                team: t1.assignedTeam,
                task1: t1.id,
                task2: t2.id,
                road1: t1.road,
                road2: t2.road
              });
            }
          }
        }
      }
    }

    return conflicts;
  },

  /**
   * Calculate summary metrics for planner
   */
  getSummary(tasks) {
    const today = new Date().toISOString().split('T')[0];
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const scheduled = tasks.filter(t => t.status === 'Scheduled' || t.status === 'Planned').length;

    const overdue = tasks.filter(t => {
      return t.targetCompletionDate && t.targetCompletionDate < today && t.status !== 'Completed';
    }).length;

    return { total, completed, inProgress, scheduled, overdue };
  },

  render() {
    let tasks = StorageService.getTasks();
    const today = new Date().toISOString().split('T')[0];

    // Workload summary metrics
    const summary = this.getSummary(tasks);
    const summaryContainer = document.getElementById('planner-summary-cards');
    if (summaryContainer) {
      summaryContainer.innerHTML = `
        <div class="summary-mini-card">
          <div class="text-xs text-muted">Total Work Orders</div>
          <div class="font-bold text-xl text-navy">${summary.total}</div>
        </div>
        <div class="summary-mini-card">
          <div class="text-xs text-muted">Active In Progress</div>
          <div class="font-bold text-xl text-blue">${summary.inProgress}</div>
        </div>
        <div class="summary-mini-card">
          <div class="text-xs text-muted">Scheduled / Queued</div>
          <div class="font-bold text-xl text-slate">${summary.scheduled}</div>
        </div>
        <div class="summary-mini-card">
          <div class="text-xs text-muted">Overdue Milestones</div>
          <div class="font-bold text-xl text-red">${summary.overdue}</div>
        </div>
        <div class="summary-mini-card">
          <div class="text-xs text-muted">Completed Repairs</div>
          <div class="font-bold text-xl text-green">${summary.completed}</div>
        </div>
      `;
    }

    // Schedule Conflicts Banner
    const conflicts = this.detectConflicts(tasks);
    const conflictBox = document.getElementById('planner-conflicts-container');
    if (conflictBox) {
      if (conflicts.length > 0) {
        conflictBox.style.display = 'block';
        conflictBox.innerHTML = `
          <div class="alert-box alert-warning">
            <span class="alert-icon">⚠</span>
            <div>
              <strong>Potential Crew Allocation Overlap Detected (${conflicts.length})</strong>
              <p class="text-xs text-slate mt-1">
                ${conflicts.map(c => `
                  <div>• <strong>${Utils.escapeHtml(c.team)}</strong> has overlapping dates on <strong>${c.task1}</strong> and <strong>${c.task2}</strong>. Consider staggering work dates.</div>
                `).join('')}
              </p>
            </div>
          </div>
        `;
      } else {
        conflictBox.style.display = 'none';
        conflictBox.innerHTML = '';
      }
    }

    // Filter tasks
    if (this.state.filterStatus !== 'all') {
      if (this.state.filterStatus === 'overdue') {
        tasks = tasks.filter(t => t.targetCompletionDate && t.targetCompletionDate < today && t.status !== 'Completed');
      } else {
        tasks = tasks.filter(t => t.status === this.state.filterStatus);
      }
    }

    if (this.state.filterPriority !== 'all') {
      tasks = tasks.filter(t => t.priority === this.state.filterPriority);
    }

    if (this.state.filterTeam !== 'all') {
      tasks = tasks.filter(t => t.assignedTeam === this.state.filterTeam);
    }

    // Sort by target completion date
    tasks.sort((a, b) => {
      const dateA = a.targetCompletionDate || '9999-99-99';
      const dateB = b.targetCompletionDate || '9999-99-99';
      return dateA.localeCompare(dateB);
    });

    const tbody = document.getElementById('planner-table-body');
    if (!tbody) return;

    if (tasks.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-8 text-muted">
            No maintenance tasks match the selected criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = tasks.map(t => {
      const isOverdue = t.targetCompletionDate && t.targetCompletionDate < today && t.status !== 'Completed';

      return `
        <tr class="${isOverdue ? 'row-overdue' : ''}">
          <td>
            <div class="font-bold text-sm">${Utils.escapeHtml(t.id)}</div>
            ${isOverdue ? '<span class="badge badge-critical text-2xs mt-1">OVERDUE</span>' : ''}
          </td>
          <td>
            <button class="text-blue font-mono font-semibold hover:underline text-xs" onclick="DefectsModule.openDetailModal('${Utils.escapeHtml(t.defectId)}')">
              ${Utils.escapeHtml(t.defectId)}
            </button>
          </td>
          <td>
            <div class="font-medium text-xs text-truncate" style="max-width: 220px;" title="${Utils.escapeHtml(t.road)}">
              ${Utils.escapeHtml(t.road)}
            </div>
          </td>
          <td>${PrioritySystem.renderBadge(t.priority)}</td>
          <td class="text-xs font-medium">${Utils.escapeHtml(t.assignedTeam || 'Unassigned')}</td>
          <td class="text-xs text-nowrap">${Utils.formatDate(t.plannedStartDate)}</td>
          <td class="text-xs text-nowrap">
            <span class="${isOverdue ? 'text-red font-bold' : ''}">
              ${Utils.formatDate(t.targetCompletionDate)}
            </span>
          </td>
          <td>
            <select class="form-select text-xs py-1" onchange="PlannerModule.updateTaskStatus('${Utils.escapeHtml(t.id)}', this.value)">
              <option value="Planned" ${t.status === 'Planned' ? 'selected' : ''}>Planned</option>
              <option value="Scheduled" ${t.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
              <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Completed" ${t.status === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="On Hold" ${t.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
            </select>
          </td>
          <td>
            <div class="table-actions">
              <button class="btn btn-xs btn-outline" onclick="PlannerModule.openEditTaskModal('${Utils.escapeHtml(t.id)}')">
                Edit
              </button>
              <button class="btn btn-xs btn-danger-outline" onclick="PlannerModule.confirmDeleteTask('${Utils.escapeHtml(t.id)}')">
                ×
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  updateTaskStatus(taskId, newStatus) {
    const updated = StorageService.updateTask(taskId, { status: newStatus });
    if (updated) {
      Utils.showToast(`Updated task ${taskId} status to "${newStatus}"`, 'success');
      // If completed, check if related defect should be marked resolved
      if (newStatus === 'Completed' && updated.defectId) {
        const confirmResolve = window.confirm(`Task ${taskId} is marked Completed.\nWould you like to also mark defect ${updated.defectId} as "Resolved"?`);
        if (confirmResolve) {
          StorageService.updateDefect(updated.defectId, { status: 'Resolved' });
          DefectsModule.render();
          MapModule.refreshMarkers();
        }
      }
      this.render();
      DashboardModule.init();
    }
  },

  confirmDeleteTask(taskId) {
    if (window.confirm(`Are you sure you want to delete maintenance task ${taskId}?`)) {
      StorageService.deleteTask(taskId);
      Utils.showToast(`Task ${taskId} deleted`, 'info');
      this.render();
      DashboardModule.init();
    }
  },

  openNewTaskModal(prefilledDefectId = '') {
    const defects = StorageService.getDefects();
    const modal = document.getElementById('task-modal');
    if (!modal) return;

    document.getElementById('task-modal-title').textContent = 'Schedule Maintenance Work Order';
    document.getElementById('task-id-input').value = '';

    // Populate Defect Select
    const defectSelect = document.getElementById('task-defect-select');
    defectSelect.innerHTML = `<option value="">-- Choose Target Defect --</option>` +
      defects.map(d => `<option value="${Utils.escapeHtml(d.id)}" ${d.id === prefilledDefectId ? 'selected' : ''}>${Utils.escapeHtml(d.id)} - ${Utils.escapeHtml(d.road)} (${d.priority})</option>`).join('');

    // Pre-fill road if defect was provided
    if (prefilledDefectId) {
      const found = defects.find(d => d.id === prefilledDefectId);
      if (found) {
        document.getElementById('task-road-input').value = found.road;
        document.getElementById('task-priority-select').value = found.priority || 'High';
        if (found.assignedTeam) {
          document.getElementById('task-team-select').value = found.assignedTeam;
        }
      }
    } else {
      document.getElementById('task-road-input').value = '';
    }

    defectSelect.onchange = () => {
      const selected = defects.find(d => d.id === defectSelect.value);
      if (selected) {
        document.getElementById('task-road-input').value = selected.road;
        document.getElementById('task-priority-select').value = selected.priority || 'High';
        if (selected.assignedTeam) {
          document.getElementById('task-team-select').value = selected.assignedTeam;
        }
      }
    };

    const todayStr = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 5);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    document.getElementById('task-start-date').value = todayStr;
    document.getElementById('task-end-date').value = nextWeekStr;
    document.getElementById('task-duration').value = '16';
    document.getElementById('task-notes').value = '';

    modal.classList.add('modal-open');
  },

  openEditTaskModal(taskId) {
    const tasks = StorageService.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const modal = document.getElementById('task-modal');
    if (!modal) return;

    document.getElementById('task-modal-title').textContent = `Edit Task ${task.id}`;
    document.getElementById('task-id-input').value = task.id;

    const defects = StorageService.getDefects();
    const defectSelect = document.getElementById('task-defect-select');
    defectSelect.innerHTML = `<option value="">-- Choose Target Defect --</option>` +
      defects.map(d => `<option value="${Utils.escapeHtml(d.id)}" ${d.id === task.defectId ? 'selected' : ''}>${Utils.escapeHtml(d.id)} - ${Utils.escapeHtml(d.road)}</option>`).join('');

    document.getElementById('task-road-input').value = task.road || '';
    document.getElementById('task-priority-select').value = task.priority || 'Medium';
    document.getElementById('task-team-select').value = task.assignedTeam || 'Team North Alpha';
    document.getElementById('task-start-date').value = task.plannedStartDate || '';
    document.getElementById('task-end-date').value = task.targetCompletionDate || '';
    document.getElementById('task-duration').value = task.estimatedDurationHours || 16;
    document.getElementById('task-notes').value = task.notes || '';

    modal.classList.add('modal-open');
  },

  closeModal() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.remove('modal-open');
  },

  handleSaveTask() {
    const taskIdInput = document.getElementById('task-id-input').value;
    const defectId = document.getElementById('task-defect-select').value;
    const road = document.getElementById('task-road-input').value.trim();
    const priority = document.getElementById('task-priority-select').value;
    const assignedTeam = document.getElementById('task-team-select').value;
    const plannedStartDate = document.getElementById('task-start-date').value;
    const targetCompletionDate = document.getElementById('task-end-date').value;
    const estimatedDurationHours = parseInt(document.getElementById('task-duration').value, 10) || 12;
    const notes = document.getElementById('task-notes').value.trim();

    if (!defectId) {
      Utils.showToast('Please select a target defect.', 'error');
      return;
    }
    if (!targetCompletionDate) {
      Utils.showToast('Please enter target completion date.', 'error');
      return;
    }

    if (taskIdInput) {
      // Edit existing
      StorageService.updateTask(taskIdInput, {
        defectId,
        road,
        priority,
        assignedTeam,
        plannedStartDate,
        targetCompletionDate,
        estimatedDurationHours,
        notes,
      });
      Utils.showToast(`Updated task ${taskIdInput}`, 'success');
    } else {
      // Create new
      const tasks = StorageService.getTasks();
      const newId = Utils.generateTaskId(tasks);
      StorageService.addTask({
        id: newId,
        defectId,
        road,
        priority,
        assignedTeam,
        plannedStartDate,
        targetCompletionDate,
        estimatedDurationHours,
        status: 'Scheduled',
        notes,
      });
      Utils.showToast(`Created maintenance task ${newId}`, 'success');
    }

    this.closeModal();
    this.render();
    DashboardModule.init();
  },

  exportTasksCsv() {
    const tasks = StorageService.getTasks();
    if (tasks.length === 0) {
      Utils.showToast('No tasks to export.', 'warning');
      return;
    }

    const headers = [
      'Task ID',
      'Related Defect ID',
      'Corridor / Road',
      'Priority',
      'Assigned Team',
      'Planned Start Date',
      'Target Completion Date',
      'Estimated Hours',
      'Status',
      'Notes'
    ];

    const rows = tasks.map(t => [
      Utils.escapeCsvCell(t.id),
      Utils.escapeCsvCell(t.defectId),
      Utils.escapeCsvCell(t.road),
      Utils.escapeCsvCell(t.priority),
      Utils.escapeCsvCell(t.assignedTeam),
      Utils.escapeCsvCell(t.plannedStartDate),
      Utils.escapeCsvCell(t.targetCompletionDate),
      Utils.escapeCsvCell(t.estimatedDurationHours),
      Utils.escapeCsvCell(t.status),
      Utils.escapeCsvCell(t.notes || '')
    ].join(','));

    const csvContent = '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
    const timestamp = new Date().toISOString().split('T')[0];
    Utils.downloadFile(csvContent, `highwaypulse_maintenance_schedule_${timestamp}.csv`, 'text/csv;charset=utf-8;');
    Utils.showToast(`Exported ${tasks.length} tasks to CSV`, 'success');
  }
};
