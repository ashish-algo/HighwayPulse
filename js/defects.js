/**
 * HIGHWAYPULSE — DEFECT MANAGEMENT MODULE (js/defects.js)
 
 * PURPOSE & UI RESPONSIBILITY:
 * This file powers the central Defect Management section (#view-defects).
 * It provides an engineering-grade tabular data grid with multi-parameter
 * searching, compound dropdown filtering, bi-directional column sorting,
 * client-side pagination, CSV export, and a rich inspection modal.
 *
 * KEY FEATURES IMPLEMENTED IN THIS FILE:
 * 1. Compound Search & Filtering:
 *    - Real-time text search querying Defect ID, Corridor, Location, and Assigned Unit.
 *    - Priority Filter (All, Critical, High, Medium, Low).
 *    - Workflow Status Filter (All, Open, Under Review, In Progress, Resolved).
 *    - Dynamic Category & Corridor Filters (automatically populated from unique data).
 *    - One-click filter reset button.
 * 2. Multi-Column Bi-Directional Sorting:
 *    - Sort by Priority Score, Reported Date, Severity, Road Corridor, or Status.
 *    - Visual column header indicators (▲ asc, ▼ desc, ⇅ inactive).
 * 3. Client-Side Pagination & Record Counters:
 *    - Configurable page size (10, 25, 50 records per page).
 *    - Page navigation buttons with accessible disabled states.
 *    - Live "Showing X to Y of Z defects" count.
 * 4. Defect Inspection & Triage Modal:
 *    - Full inspection card with chainage markers, geographic coordinates, and notes.
 *    - Explainable Heuristic Priority Breakdown: shows mathematical contributions
 *      from Severity (40%), Traffic Exposure (25%), Safety Risk (25%), and Time (10%).
 *    - Live in-modal status updating and crew reassignment without page reloads.
 *    - Quick action button to immediately schedule a maintenance work order in Planner.
 * 5. Data Export:
 *    - Exports active filtered dataset to standard CSV format with safe field quoting.
 *
 * HOW TO STUDY THIS FILE:
 * - Study `getFilteredAndSortedData()` to understand multi-stage data processing:
 *   Array.prototype.filter -> Array.prototype.sort.
 * - Examine `renderTable()` to see programmatic HTML table generation and zero-pill badge injection.
 * - Review `openDetailModal(defectId)` to observe how deep state inspection and
 *   explainable mathematical scoring are presented clearly in an overlay modal.
 *
 * DEPENDENCIES:
 * - js/utils.js: For `Utils.escapeHtml()`, `Utils.formatDate()`, `Utils.exportToCsv()`.
 * - js/storage.js: For `StorageService.getDefects()` and `StorageService.updateDefect()`.
 * - js/priority.js: For `PrioritySystem.calculate()` and `PrioritySystem.getBadgeHtml()`.
 */

const DefectsModule = {
  // Current table state
  state: {
    search: '',
    filterPriority: 'all',
    filterStatus: 'all',
    filterCategory: 'all',
    filterRoad: 'all',
    sortField: 'priorityScore', // 'priorityScore' | 'reportedDate' | 'severity' | 'status'
    sortDirection: 'desc',      // 'asc' | 'desc'
    currentPage: 1,
    pageSize: 10,
  },

  init() {
    this.populateFilterDropdowns();
    this.setupEventListeners();
    this.render();
  },

  populateFilterDropdowns() {
    const defects = StorageService.getDefects();

    // Categories
    const categories = Array.from(new Set(defects.map(d => d.category).filter(Boolean))).sort();
    const catSelect = document.getElementById('filter-defect-category');
    if (catSelect) {
      catSelect.innerHTML = `<option value="all">All Categories</option>` +
        categories.map(c => `<option value="${Utils.escapeHtml(c)}">${Utils.escapeHtml(c)}</option>`).join('');
    }

    // Roads
    const roads = Array.from(new Set(defects.map(d => d.road).filter(Boolean))).sort();
    const roadSelect = document.getElementById('filter-defect-road');
    if (roadSelect) {
      roadSelect.innerHTML = `<option value="all">All Corridors & Roads</option>` +
        roads.map(r => `<option value="${Utils.escapeHtml(r)}">${Utils.escapeHtml(r)}</option>`).join('');
    }
  },

  setupEventListeners() {
    // Search input with debounce
    const searchInput = document.getElementById('defect-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.search = e.target.value.trim().toLowerCase();
        this.state.currentPage = 1;
        this.render();
      });
    }

    // Filter selectors
    const prioritySelect = document.getElementById('filter-defect-priority');
    if (prioritySelect) {
      prioritySelect.addEventListener('change', (e) => {
        this.state.filterPriority = e.target.value;
        this.state.currentPage = 1;
        this.render();
      });
    }

    const statusSelect = document.getElementById('filter-defect-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.state.filterStatus = e.target.value;
        this.state.currentPage = 1;
        this.render();
      });
    }

    const categorySelect = document.getElementById('filter-defect-category');
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        this.state.filterCategory = e.target.value;
        this.state.currentPage = 1;
        this.render();
      });
    }

    const roadSelect = document.getElementById('filter-defect-road');
    if (roadSelect) {
      roadSelect.addEventListener('change', (e) => {
        this.state.filterRoad = e.target.value;
        this.state.currentPage = 1;
        this.render();
      });
    }

    // Reset filters button
    const resetBtn = document.getElementById('btn-reset-defect-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetFilters();
      });
    }

    // Page size selector
    const pageSizeSelect = document.getElementById('defect-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.value = String(this.state.pageSize);
      pageSizeSelect.addEventListener('change', (e) => {
        this.state.pageSize = e.target.value === 'all' ? 9999 : parseInt(e.target.value, 10);
        this.state.currentPage = 1;
        this.render();
      });
    }

    // Sort table headers
    const sortHeaders = document.querySelectorAll('.th-sortable');
    sortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort-field');
        if (!field) return;

        if (this.state.sortField === field) {
          this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortField = field;
          this.state.sortDirection = 'desc'; // default high-to-low
        }
        this.render();
      });
    });

    // Delegated actions for table buttons
    const tableBody = document.getElementById('defects-table-body');
    if (tableBody) {
      tableBody.addEventListener('click', (e) => {
        const inspectBtn = e.target.closest('.btn-inspect');
        if (inspectBtn) {
          const id = inspectBtn.getAttribute('data-id');
          this.openDetailModal(id);
          return;
        }

        const editBtn = e.target.closest('.btn-edit');
        if (editBtn) {
          const id = editBtn.getAttribute('data-id');
          this.openEditModal(id);
          return;
        }

        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
          const id = deleteBtn.getAttribute('data-id');
          this.confirmDelete(id);
          return;
        }

        const quickStatusBtn = e.target.closest('.btn-quick-status');
        if (quickStatusBtn) {
          const id = quickStatusBtn.getAttribute('data-id');
          const nextStatus = quickStatusBtn.getAttribute('data-next-status');
          this.quickUpdateStatus(id, nextStatus);
          return;
        }
      });
    }

    // CSV Export button in defect management
    const exportBtn = document.getElementById('btn-export-defects-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportToCsv();
      });
    }
  },

  setFilter(type, value) {
    if (type === 'priority') {
      this.state.filterPriority = value;
      const el = document.getElementById('filter-defect-priority');
      if (el) el.value = value;
    } else if (type === 'status') {
      this.state.filterStatus = value;
      const el = document.getElementById('filter-defect-status');
      if (el) el.value = value;
    }
    this.state.currentPage = 1;
    this.render();
  },

  resetFilters() {
    this.state.search = '';
    this.state.filterPriority = 'all';
    this.state.filterStatus = 'all';
    this.state.filterCategory = 'all';
    this.state.filterRoad = 'all';
    this.state.currentPage = 1;

    const searchInput = document.getElementById('defect-search-input');
    if (searchInput) searchInput.value = '';
    const pri = document.getElementById('filter-defect-priority');
    if (pri) pri.value = 'all';
    const sta = document.getElementById('filter-defect-status');
    if (sta) sta.value = 'all';
    const cat = document.getElementById('filter-defect-category');
    if (cat) cat.value = 'all';
    const road = document.getElementById('filter-defect-road');
    if (road) road.value = 'all';

    this.render();
    Utils.showToast('Filters reset to default', 'info');
  },

  /**
   * Filter, search, and sort records
   */
  getFilteredRecords() {
    let records = StorageService.getDefects();

    // Search query
    if (this.state.search) {
      const q = this.state.search;
      records = records.filter(d => {
        return (
          (d.id && d.id.toLowerCase().includes(q)) ||
          (d.road && d.road.toLowerCase().includes(q)) ||
          (d.location && d.location.toLowerCase().includes(q)) ||
          (d.category && d.category.toLowerCase().includes(q)) ||
          (d.assignedTeam && d.assignedTeam.toLowerCase().includes(q)) ||
          (d.description && d.description.toLowerCase().includes(q))
        );
      });
    }

    // Priority filter
    if (this.state.filterPriority !== 'all') {
      records = records.filter(d => d.priority === this.state.filterPriority);
    }

    // Status filter
    if (this.state.filterStatus !== 'all') {
      records = records.filter(d => d.status === this.state.filterStatus);
    }

    // Category filter
    if (this.state.filterCategory !== 'all') {
      records = records.filter(d => d.category === this.state.filterCategory);
    }

    // Road filter
    if (this.state.filterRoad !== 'all') {
      records = records.filter(d => d.road === this.state.filterRoad);
    }

    // Sorting
    const field = this.state.sortField;
    const isAsc = this.state.sortDirection === 'asc';

    records.sort((a, b) => {
      let valA = a[field];
      let valB = b[field];

      if (field === 'reportedDate') {
        valA = new Date(valA).getTime() || 0;
        valB = new Date(valB).getTime() || 0;
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }

      if (valA < valB) return isAsc ? -1 : 1;
      if (valA > valB) return isAsc ? 1 : -1;
      return 0;
    });

    return records;
  },

  /**
   * Render table, active headers, and pagination
   */
  render() {
    const allFiltered = this.getFilteredRecords();
    const totalRecords = allFiltered.length;

    // Update sort header classes
    document.querySelectorAll('.th-sortable').forEach(th => {
      const field = th.getAttribute('data-sort-field');
      th.classList.remove('sort-asc', 'sort-desc');
      if (field === this.state.sortField) {
        th.classList.add(this.state.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });

    // Pagination calculations
    const pageSize = this.state.pageSize;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    if (this.state.currentPage > totalPages) this.state.currentPage = totalPages;

    const startIndex = (this.state.currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    const pagedRecords = allFiltered.slice(startIndex, endIndex);

    // Render table rows
    const tbody = document.getElementById('defects-table-body');
    if (!tbody) return;

    if (pagedRecords.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="12" class="text-center py-8">
            <div class="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <p class="font-medium mt-2">No matching highway defects found</p>
              <p class="text-xs text-muted">Try adjusting your search criteria or clearing filters.</p>
              <button class="btn btn-sm btn-outline mt-3" onclick="DefectsModule.resetFilters()">Clear Filters</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = pagedRecords.map(d => {
        // Quick next status option
        let nextStatus = 'In Progress';
        if (d.status === 'Open') nextStatus = 'Under Review';
        else if (d.status === 'Under Review') nextStatus = 'In Progress';
        else if (d.status === 'In Progress') nextStatus = 'Resolved';
        else if (d.status === 'Resolved') nextStatus = 'Open';

        return `
          <tr>
            <td><strong class="text-sm">${Utils.escapeHtml(d.id)}</strong></td>
            <td>
              <div class="font-medium text-sm text-truncate" title="${Utils.escapeHtml(d.road)}">${Utils.escapeHtml(d.road)}</div>
              <div class="text-xs text-muted text-truncate" title="${Utils.escapeHtml(d.location)}">${Utils.escapeHtml(d.location)}</div>
            </td>
            <td><span class="category-tag">${Utils.escapeHtml(d.category)}</span></td>
            <td class="text-center font-mono">${d.severity || 0}</td>
            <td class="text-center font-mono">${d.trafficExposure || 0}</td>
            <td class="text-center font-mono">${d.safetyRisk || 0}</td>
            <td class="text-center">
              <span class="font-bold font-mono text-base ${d.priorityScore >= 80 ? 'text-red' : d.priorityScore >= 60 ? 'text-orange' : ''}">
                ${d.priorityScore || 0}
              </span>
            </td>
            <td>${PrioritySystem.renderBadge(d.priority, d.priorityScore)}</td>
            <td class="text-nowrap text-xs">${Utils.formatDate(d.reportedDate)}</td>
            <td>${PrioritySystem.renderStatusBadge(d.status)}</td>
            <td class="text-xs text-muted text-truncate" title="${Utils.escapeHtml(d.assignedTeam || 'Unassigned')}">
              ${Utils.escapeHtml(d.assignedTeam || 'Unassigned')}
            </td>
            <td>
              <div class="table-actions">
                <button class="btn btn-xs btn-outline btn-inspect" data-id="${Utils.escapeHtml(d.id)}" title="Inspect Defect">
                  View
                </button>
                <button class="btn btn-xs btn-outline btn-quick-status" data-id="${Utils.escapeHtml(d.id)}" data-next-status="${nextStatus}" title="Move to ${nextStatus}">
                  ${nextStatus === 'Resolved' ? 'Resolve' : 'Advance'}
                </button>
                <button class="btn btn-xs btn-danger-outline btn-delete" data-id="${Utils.escapeHtml(d.id)}" title="Delete Record">
                  ×
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Render pagination summary and controls
    this.renderPagination(totalRecords, startIndex, endIndex, totalPages);
  },

  renderPagination(totalRecords, startIndex, endIndex, totalPages) {
    const summaryEl = document.getElementById('defect-page-info');
    if (summaryEl) {
      if (totalRecords === 0) {
        summaryEl.textContent = 'Showing 0 records';
      } else {
        summaryEl.textContent = `Showing ${startIndex + 1}–${endIndex} of ${totalRecords} records`;
      }
    }

    const controlsEl = document.getElementById('defect-pagination-controls');
    if (!controlsEl) return;

    if (totalPages <= 1) {
      controlsEl.innerHTML = '';
      return;
    }

    let buttonsHtml = `
      <button class="btn btn-sm btn-outline pagination-btn" ${this.state.currentPage === 1 ? 'disabled' : ''} onclick="DefectsModule.goToPage(${this.state.currentPage - 1})">
        ← Prev
      </button>
    `;

    // Render limited page numbers
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= this.state.currentPage - 1 && p <= this.state.currentPage + 1)) {
        buttonsHtml += `
          <button class="btn btn-sm ${p === this.state.currentPage ? 'btn-primary' : 'btn-outline'} pagination-btn" onclick="DefectsModule.goToPage(${p})">
            ${p}
          </button>
        `;
      } else if (p === this.state.currentPage - 2 || p === this.state.currentPage + 2) {
        buttonsHtml += `<span class="pagination-ellipsis">…</span>`;
      }
    }

    buttonsHtml += `
      <button class="btn btn-sm btn-outline pagination-btn" ${this.state.currentPage === totalPages ? 'disabled' : ''} onclick="DefectsModule.goToPage(${this.state.currentPage + 1})">
        Next →
      </button>
    `;

    controlsEl.innerHTML = buttonsHtml;
  },

  goToPage(page) {
    this.state.currentPage = page;
    this.render();
    const tableTop = document.getElementById('defects-table-wrapper');
    if (tableTop) tableTop.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  quickUpdateStatus(id, newStatus) {
    const updated = StorageService.updateDefect(id, { status: newStatus });
    if (updated) {
      Utils.showToast(`Updated ${id} status to "${newStatus}"`, 'success');
      this.render();
      DashboardModule.init();
      MapModule.refreshMarkers();
    }
  },

  confirmDelete(id) {
    const confirmed = window.confirm(`Are you sure you want to permanently delete defect ${id}?\n\nThis action cannot be undone.`);
    if (confirmed) {
      const ok = StorageService.deleteDefect(id);
      if (ok) {
        Utils.showToast(`Defect ${id} was deleted.`, 'info');
        this.render();
        DashboardModule.init();
        MapModule.refreshMarkers();
      }
    }
  },

  /**
   * Open full Inspect Detail Modal
   */
  openDetailModal(id) {
    const defects = StorageService.getDefects();
    const defect = defects.find(d => d.id === id);
    if (!defect) {
      Utils.showToast('Defect record not found.', 'error');
      return;
    }

    // Ensure score breakdown exists
    const calc = PrioritySystem.calculate(
      defect.severity || 0,
      defect.trafficExposure || 0,
      defect.safetyRisk || 0,
      defect.timeUnresolved || 0
    );

    const modal = document.getElementById('defect-detail-modal');
    if (!modal) return;

    const modalBody = modal.querySelector('.modal-body');
    if (!modalBody) return;

    modalBody.innerHTML = `
      <div class="detail-header-card">
        <div class="flex justify-between items-start flex-wrap gap-2">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-bold text-navy">${Utils.escapeHtml(defect.id)}</h2>
              ${PrioritySystem.renderBadge(defect.priority, defect.priorityScore)}
              ${PrioritySystem.renderStatusBadge(defect.status)}
            </div>
            <p class="text-sm font-medium mt-1 text-slate">${Utils.escapeHtml(defect.road)}</p>
            <p class="text-xs text-muted">${Utils.escapeHtml(defect.location)}</p>
          </div>
          <div class="text-right">
            <span class="text-xs text-muted">Reported on</span>
            <div class="font-medium text-sm">${Utils.formatDate(defect.reportedDate)}</div>
            <div class="text-xs text-muted mt-1">Lat: ${defect.latitude || 'N/A'}, Lng: ${defect.longitude || 'N/A'}</div>
          </div>
        </div>
      </div>

      <div class="detail-grid mt-4">
        <!-- Left: Defect Specs & Notes -->
        <div class="detail-main">
          <div class="detail-section">
            <h4 class="detail-heading">Defect Description & Field Observations</h4>
            <p class="text-sm bg-surface-subtle p-3 rounded leading-relaxed">
              ${Utils.escapeHtml(defect.description || 'No detailed field observations provided.')}
            </p>
          </div>

          <!-- Priority Scoring Explanation Card -->
          <div class="detail-section mt-4">
            <div class="flex justify-between items-center mb-2">
              <h4 class="detail-heading mb-0">Multi-Criteria Priority Scoring Breakdown</h4>
              <span class="font-bold text-base font-mono text-blue">${calc.displayScore} / 100</span>
            </div>

            <div class="score-breakdown-table">
              <div class="score-row header">
                <span>Evaluation Factor</span>
                <span>Rating</span>
                <span>Weight</span>
                <span>Contribution</span>
              </div>
              <div class="score-row">
                <span><strong>Severity:</strong> Structural damage scale</span>
                <span class="font-mono">${calc.breakdown.severity.input}</span>
                <span class="font-mono">40%</span>
                <span class="font-mono font-bold text-blue">${calc.breakdown.severity.contribution}</span>
              </div>
              <div class="score-row">
                <span><strong>Traffic Exposure:</strong> Corridor volume & speed</span>
                <span class="font-mono">${calc.breakdown.traffic.input}</span>
                <span class="font-mono">25%</span>
                <span class="font-mono font-bold text-blue">${calc.breakdown.traffic.contribution}</span>
              </div>
              <div class="score-row">
                <span><strong>Safety Risk:</strong> Threat to motorists & vehicles</span>
                <span class="font-mono">${calc.breakdown.safety.input}</span>
                <span class="font-mono">25%</span>
                <span class="font-mono font-bold text-blue">${calc.breakdown.safety.contribution}</span>
              </div>
              <div class="score-row">
                <span><strong>Time Unresolved:</strong> Hazard dwell penalty</span>
                <span class="font-mono">${calc.breakdown.time.input}</span>
                <span class="font-mono">10%</span>
                <span class="font-mono font-bold text-blue">${calc.breakdown.time.contribution}</span>
              </div>
              <div class="score-row total">
                <span><strong>Composite Calculated Score</strong></span>
                <span>—</span>
                <span>100%</span>
                <span class="font-mono font-bold text-lg text-navy">${calc.displayScore} (${calc.category})</span>
              </div>
            </div>

            <p class="text-xs text-muted mt-2 italic">
              * Heuristic Formula: (Severity × 0.40) + (Traffic × 0.25) + (Safety × 0.25) + (Time × 0.10).
              Created strictly for demonstration in this educational portfolio dashboard.
            </p>
          </div>

          <!-- Maintenance Notes Section -->
          <div class="detail-section mt-4">
            <h4 class="detail-heading">Maintenance Operations Log</h4>
            <div id="defect-notes-log" class="notes-log-box mb-3">
              <p class="text-xs bg-surface-subtle p-2 rounded text-slate">
                ${Utils.escapeHtml(defect.notes || 'No active maintenance notes yet.')}
              </p>
            </div>

            <div class="flex gap-2">
              <input type="text" id="input-new-note" class="form-input text-xs flex-1" placeholder="Append new maintenance update note..." />
              <button class="btn btn-sm btn-outline" id="btn-add-note">Add Note</button>
            </div>
          </div>
        </div>

        <!-- Right: Status Actions & Metadata -->
        <div class="detail-sidebar">
          <div class="detail-section">
            <h4 class="detail-heading">Workflow Status</h4>
            <label class="form-label text-xs">Update Status</label>
            <select id="modal-select-status" class="form-select mb-3 text-xs">
              <option value="Open" ${defect.status === 'Open' ? 'selected' : ''}>Open</option>
              <option value="Under Review" ${defect.status === 'Under Review' ? 'selected' : ''}>Under Review</option>
              <option value="In Progress" ${defect.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Resolved" ${defect.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
            </select>

            <label class="form-label text-xs">Assigned Maintenance Team</label>
            <select id="modal-select-team" class="form-select mb-4 text-xs">
              <option value="Team North Alpha" ${defect.assignedTeam === 'Team North Alpha' ? 'selected' : ''}>Team North Alpha</option>
              <option value="Team West Bravo" ${defect.assignedTeam === 'Team West Bravo' ? 'selected' : ''}>Team West Bravo</option>
              <option value="Team South Charlie" ${defect.assignedTeam === 'Team South Charlie' ? 'selected' : ''}>Team South Charlie</option>
              <option value="Rapid Patch Unit 1" ${defect.assignedTeam === 'Rapid Patch Unit 1' ? 'selected' : ''}>Rapid Patch Unit 1</option>
              <option value="Structural Inspection Crew" ${defect.assignedTeam === 'Structural Inspection Crew' ? 'selected' : ''}>Structural Inspection Crew</option>
              <option value="Drainage Works Unit" ${defect.assignedTeam === 'Drainage Works Unit' ? 'selected' : ''}>Drainage Works Unit</option>
              <option value="Corridor Alpha Crew" ${defect.assignedTeam === 'Corridor Alpha Crew' ? 'selected' : ''}>Corridor Alpha Crew</option>
              <option value="Unassigned" ${!defect.assignedTeam || defect.assignedTeam === 'Unassigned' ? 'selected' : ''}>Unassigned</option>
            </select>

            <button class="btn btn-sm btn-primary w-full mb-2" id="btn-save-modal-status">
              Save Status & Team
            </button>
            
            <button class="btn btn-sm btn-outline w-full mb-2" id="btn-view-on-map">
              View on Map
            </button>

            <button class="btn btn-sm btn-secondary w-full" id="btn-create-task-for-defect">
              + Plan Maintenance Task
            </button>
          </div>

          <div class="detail-section mt-4">
            <h4 class="detail-heading">Geographic Coordinates</h4>
            <div class="text-xs font-mono bg-surface-subtle p-2 rounded">
              <div>Latitude: ${defect.latitude ? defect.latitude.toFixed(4) : 'N/A'}° N</div>
              <div>Longitude: ${defect.longitude ? defect.longitude.toFixed(4) : 'N/A'}° E</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook up modal buttons
    const saveBtn = document.getElementById('btn-save-modal-status');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const newStatus = document.getElementById('modal-select-status').value;
        const newTeam = document.getElementById('modal-select-team').value;
        StorageService.updateDefect(defect.id, { status: newStatus, assignedTeam: newTeam });
        Utils.showToast(`Updated ${defect.id} workflow status`, 'success');
        this.render();
        DashboardModule.init();
        MapModule.refreshMarkers();
        this.closeModal();
      };
    }

    const mapBtn = document.getElementById('btn-view-on-map');
    if (mapBtn) {
      mapBtn.onclick = () => {
        this.closeModal();
        App.navigateTo('map');
        if (defect.latitude && defect.longitude) {
          MapModule.focusLocation(defect.latitude, defect.longitude, defect.id);
        }
      };
    }

    const taskBtn = document.getElementById('btn-create-task-for-defect');
    if (taskBtn) {
      taskBtn.onclick = () => {
        this.closeModal();
        App.navigateTo('planner');
        PlannerModule.openNewTaskModal(defect.id);
      };
    }

    const addNoteBtn = document.getElementById('btn-add-note');
    if (addNoteBtn) {
      addNoteBtn.onclick = () => {
        const input = document.getElementById('input-new-note');
        if (!input || !input.value.trim()) return;
        const timestamp = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        const appended = defect.notes ? `${defect.notes}\n[${timestamp}] ${input.value.trim()}` : `[${timestamp}] ${input.value.trim()}`;
        StorageService.updateDefect(defect.id, { notes: appended });
        defect.notes = appended;
        input.value = '';
        Utils.showToast('Note added to defect log', 'info');
        const notesBox = document.getElementById('defect-notes-log');
        if (notesBox) {
          notesBox.innerHTML = `<p class="text-xs bg-surface-subtle p-2 rounded text-slate" style="white-space: pre-line;">${Utils.escapeHtml(appended)}</p>`;
        }
      };
    }

    modal.classList.add('modal-open');
  },

  closeModal() {
    const modal = document.getElementById('defect-detail-modal');
    if (modal) modal.classList.remove('modal-open');
  },

  /**
   * Export currently filtered defects to RFC 4180 compliant CSV
   */
  exportToCsv() {
    const records = this.getFilteredRecords();
    if (records.length === 0) {
      Utils.showToast('No records match current filters to export.', 'warning');
      return;
    }

    const headers = [
      'Defect ID',
      'Road / Corridor',
      'Location Marker',
      'Category',
      'Severity (0-100)',
      'Traffic Exposure (0-100)',
      'Safety Risk (0-100)',
      'Time Unresolved (0-100)',
      'Priority Score',
      'Priority Classification',
      'Status',
      'Reported Date',
      'Assigned Team',
      'Latitude',
      'Longitude',
      'Description',
      'Maintenance Notes'
    ];

    const rows = records.map(d => [
      Utils.escapeCsvCell(d.id),
      Utils.escapeCsvCell(d.road),
      Utils.escapeCsvCell(d.location),
      Utils.escapeCsvCell(d.category),
      Utils.escapeCsvCell(d.severity),
      Utils.escapeCsvCell(d.trafficExposure),
      Utils.escapeCsvCell(d.safetyRisk),
      Utils.escapeCsvCell(d.timeUnresolved),
      Utils.escapeCsvCell(d.priorityScore),
      Utils.escapeCsvCell(d.priority),
      Utils.escapeCsvCell(d.status),
      Utils.escapeCsvCell(d.reportedDate),
      Utils.escapeCsvCell(d.assignedTeam || 'Unassigned'),
      Utils.escapeCsvCell(d.latitude),
      Utils.escapeCsvCell(d.longitude),
      Utils.escapeCsvCell(d.description),
      Utils.escapeCsvCell(d.notes || '')
    ].join(','));

    const csvContent = '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
    const timestamp = new Date().toISOString().split('T')[0];
    Utils.downloadFile(csvContent, `highwaypulse_defects_${timestamp}.csv`, 'text/csv;charset=utf-8;');
    Utils.showToast(`Exported ${records.length} defect records to CSV`, 'success');
  }
};
