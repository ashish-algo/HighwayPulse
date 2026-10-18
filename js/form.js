/**
 * HIGHWAYPULSE — REPORT DEFECT FORM MODULE (js/form.js)
 
 * PURPOSE & UI RESPONSIBILITY:
 * This file powers the field defect intake view (#view-report).
 * It manages form validation, real-time interactive calculation of priority scores
 * as range sliders move, quick coordinate filling, and storing new inspection records.
 *
 * KEY FEATURES IMPLEMENTED IN THIS FILE:
 * 1. Real-Time Dynamic Priority Preview:
 *    - Automatically updates the live preview card and score meter on every slider `input` event.
 *    - Explains mathematical score contributions from Severity (40%), Traffic Exposure (25%),
 *      and Safety Risk (25%) before submitting.
 * 2. Client-Side Field Validation:
 *    - Validates mandatory fields: Road name, Chainage marker, Defect category.
 *    - Validates geographic coordinates to verify valid latitude (-90 to +90) and
 *      longitude (-180 to +180) when provided.
 * 3. Quick Indian Highway Sample Coordinates:
 *    - One-click button fills realistic coordinates along prominent Indian highway corridors
 *      (e.g., Yamuna Expressway, NH 44, NH 48) to streamline demonstrations.
 * 4. Submission & State Persistence:
 *    - Generates human-readable defect ID (e.g., `DEF-2026-037`).
 *    - Persists new record to `StorageService`, shows success toast, resets form,
 *      and offers direct navigation to inspect the newly created defect.
 *
 * HOW TO STUDY THIS FILE:
 * - Study `updateLivePreview()` to learn how input events trigger instantaneous
 *   DOM updates and UI gauge re-renders in vanilla JavaScript without virtual DOM.
 * - Review `validateForm()` for clean, accessible client-side form validation patterns.
 * - Examine `handleSubmit()` to see how user input is sanitized and mapped into a
 *   structured data entity.
 *
 * DEPENDENCIES:
 * - js/utils.js: For `Utils.showToast()`, `Utils.escapeHtml()`, and ID generator.
 * - js/priority.js: For `PrioritySystem.calculate()`.
 * - js/storage.js: For `StorageService.addDefect()`.
 */

const FormModule = {
  init() {
    this.setDefaultValues();
    this.setupEventListeners();
    this.updateLivePreview();
  },

  setDefaultValues() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('form-date');
    if (dateInput) dateInput.value = today;

    // Reset range slider numbers
    this.syncSliderReadout('form-severity', 'val-severity');
    this.syncSliderReadout('form-traffic', 'val-traffic');
    this.syncSliderReadout('form-safety', 'val-safety');
  },

  syncSliderReadout(sliderId, readoutId) {
    const slider = document.getElementById(sliderId);
    const readout = document.getElementById(readoutId);
    if (slider && readout) {
      readout.textContent = slider.value;
    }
  },

  setupEventListeners() {
    // Sliders live preview
    ['form-severity', 'form-traffic', 'form-safety'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          this.syncSliderReadout(id, `val-${id.replace('form-', '')}`);
          this.updateLivePreview();
        });
      }
    });

    const dateInput = document.getElementById('form-date');
    if (dateInput) {
      dateInput.addEventListener('change', () => this.updateLivePreview());
    }

    const form = document.getElementById('report-defect-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSubmit();
      });

      form.addEventListener('reset', () => {
        setTimeout(() => {
          this.setDefaultValues();
          this.updateLivePreview();
          this.clearErrors();
        }, 50);
      });
    }

    // Quick fill example coordinates button
    const quickCoordsBtn = document.getElementById('btn-quick-sample-coords');
    if (quickCoordsBtn) {
      quickCoordsBtn.addEventListener('click', () => {
        const samples = [
          { road: 'NH 44 (Delhi–Agra Expressway)', lat: 27.892, lng: 77.581, loc: 'km 92.4 Southbound near Mathura' },
          { road: 'NH 48 (Mumbai–Pune Expressway)', lat: 18.751, lng: 73.376, loc: 'km 42.1 Southbound near Lonavala' },
          { road: 'NH 16 (Chennai–Vijayawada)', lat: 14.442, lng: 79.986, loc: 'km 176.5 Northbound near Nellore' },
          { road: 'NH 27 (Udaipur–Chittorgarh)', lat: 24.585, lng: 73.712, loc: 'km 112.0 Eastbound near Dabok' },
        ];
        const chosen = samples[Math.floor(Math.random() * samples.length)];
        const roadEl = document.getElementById('form-road');
        const latEl = document.getElementById('form-latitude');
        const lngEl = document.getElementById('form-longitude');
        const locEl = document.getElementById('form-location');

        if (roadEl) roadEl.value = chosen.road;
        if (latEl) latEl.value = chosen.lat;
        if (lngEl) lngEl.value = chosen.lng;
        if (locEl) locEl.value = chosen.loc;
        Utils.showToast('Filled illustrative highway coordinates', 'info');
      });
    }
  },

  /**
   * Calculate live preview values as user interacts with sliders
   */
  updateLivePreview() {
    const severity = parseInt(document.getElementById('form-severity')?.value, 10) || 50;
    const traffic = parseInt(document.getElementById('form-traffic')?.value, 10) || 50;
    const safety = parseInt(document.getElementById('form-safety')?.value, 10) || 50;

    const reportedDate = document.getElementById('form-date')?.value;
    const daysUnresolved = Utils.daysElapsed(reportedDate);
    // Scale days unresolved to 0-100 heuristic scale (e.g. 60+ days is 100)
    const timeScale = Math.min(100, Math.round((daysUnresolved / 60) * 100));

    const calc = PrioritySystem.calculate(severity, traffic, safety, timeScale);

    // Update live score display
    const scoreValEl = document.getElementById('preview-score-value');
    if (scoreValEl) scoreValEl.textContent = calc.displayScore;

    const badgeEl = document.getElementById('preview-badge-container');
    if (badgeEl) {
      badgeEl.innerHTML = PrioritySystem.renderBadge(calc.category, calc.displayScore);
    }

    // Update factor contributions
    const contribSev = document.getElementById('preview-contrib-severity');
    if (contribSev) contribSev.textContent = `${calc.breakdown.severity.contribution} pts`;

    const contribTraf = document.getElementById('preview-contrib-traffic');
    if (contribTraf) contribTraf.textContent = `${calc.breakdown.traffic.contribution} pts`;

    const contribSaf = document.getElementById('preview-contrib-safety');
    if (contribSaf) contribSaf.textContent = `${calc.breakdown.safety.contribution} pts`;

    const contribTime = document.getElementById('preview-contrib-time');
    if (contribTime) contribTime.textContent = `${calc.breakdown.time.contribution} pts`;
  },

  clearErrors() {
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
  },

  setError(fieldId, errorMsg) {
    const input = document.getElementById(fieldId);
    if (input) input.classList.add('has-error');
    const errEl = document.getElementById(`error-${fieldId}`);
    if (errEl) errEl.textContent = errorMsg;
  },

  validate() {
    this.clearErrors();
    let isValid = true;

    const road = document.getElementById('form-road')?.value.trim();
    if (!road) {
      this.setError('form-road', 'Please specify the highway corridor or road name.');
      isValid = false;
    }

    const location = document.getElementById('form-location')?.value.trim();
    if (!location) {
      this.setError('form-location', 'Location description (e.g. chainage km marker) is required.');
      isValid = false;
    }

    const category = document.getElementById('form-category')?.value;
    if (!category) {
      this.setError('form-category', 'Please select a defect category.');
      isValid = false;
    }

    const description = document.getElementById('form-description')?.value.trim();
    if (!description || description.length < 10) {
      this.setError('form-description', 'Please provide a clear observation description (min 10 characters).');
      isValid = false;
    }

    // Latitude & Longitude validation
    const latStr = document.getElementById('form-latitude')?.value.trim();
    const lngStr = document.getElementById('form-longitude')?.value.trim();

    if (latStr) {
      const lat = parseFloat(latStr);
      if (isNaN(lat) || lat < 6.0 || lat > 38.0) {
        this.setError('form-latitude', 'Enter a valid latitude in India (between 6.0° and 38.0° N).');
        isValid = false;
      }
    }

    if (lngStr) {
      const lng = parseFloat(lngStr);
      if (isNaN(lng) || lng < 68.0 || lng > 98.0) {
        this.setError('form-longitude', 'Enter a valid longitude in India (between 68.0° and 98.0° E).');
        isValid = false;
      }
    }

    const dateVal = document.getElementById('form-date')?.value;
    if (!dateVal) {
      this.setError('form-date', 'Reported date is required.');
      isValid = false;
    } else {
      const selected = new Date(dateVal);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (selected > tomorrow) {
        this.setError('form-date', 'Reported date cannot be in the future.');
        isValid = false;
      }
    }

    return isValid;
  },

  handleSubmit() {
    if (!this.validate()) {
      Utils.showToast('Please correct the highlighted form errors.', 'error');
      return;
    }

    const road = document.getElementById('form-road').value.trim();
    const location = document.getElementById('form-location').value.trim();
    const category = document.getElementById('form-category').value;
    const description = document.getElementById('form-description').value.trim();
    const severity = parseInt(document.getElementById('form-severity').value, 10);
    const trafficExposure = parseInt(document.getElementById('form-traffic').value, 10);
    const safetyRisk = parseInt(document.getElementById('form-safety').value, 10);
    const reportedDate = document.getElementById('form-date').value;
    const assignedTeam = document.getElementById('form-team').value;

    const latRaw = document.getElementById('form-latitude').value.trim();
    const lngRaw = document.getElementById('form-longitude').value.trim();
    const latitude = latRaw ? parseFloat(latRaw) : 21.0;
    const longitude = lngRaw ? parseFloat(lngRaw) : 78.0;

    const days = Utils.daysElapsed(reportedDate);
    const timeScale = Math.min(100, Math.round((days / 60) * 100));

    // Calculate priority
    const calc = PrioritySystem.calculate(severity, trafficExposure, safetyRisk, timeScale);

    // Generate unique ID
    const defects = StorageService.getDefects();
    const newId = Utils.generateDefectId(defects);

    const newDefect = {
      id: newId,
      road,
      location,
      latitude,
      longitude,
      category,
      description,
      severity,
      trafficExposure,
      safetyRisk,
      timeUnresolved: timeScale,
      priorityScore: calc.displayScore,
      rawPriorityScore: calc.rawScore,
      priority: calc.category,
      priorityBreakdown: calc.breakdown,
      reportedDate,
      status: 'Open',
      assignedTeam: assignedTeam || 'Unassigned',
      notes: `Report logged via HighwayPulse Field Entry.`
    };

    StorageService.addDefect(newDefect);

    // Show success dialog / banner
    const banner = document.getElementById('form-success-banner');
    if (banner) {
      banner.style.display = 'block';
      banner.innerHTML = `
        <div class="alert-box alert-success flex justify-between items-center">
          <div>
            <strong>✓ Defect Successfully Logged: ${newId}</strong>
            <p class="text-xs mt-1">Classified as <strong>${calc.category} Priority (Score: ${calc.displayScore})</strong>. Added to active database and dashboard metrics.</p>
          </div>
          <button class="btn btn-sm btn-primary" onclick="DefectsModule.openDetailModal('${newId}')">
            View New Defect
          </button>
        </div>
      `;
    }

    Utils.showToast(`Defect ${newId} logged successfully!`, 'success');

    // Reset form fields
    document.getElementById('report-defect-form').reset();
    this.setDefaultValues();
    this.updateLivePreview();

    // Refresh all other modules
    DashboardModule.init();
    DefectsModule.populateFilterDropdowns();
    DefectsModule.render();
    MapModule.refreshMarkers();
  }
};
