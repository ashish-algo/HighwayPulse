/**
 * HIGHWAYPULSE — SYSTEM SETTINGS & DATA MANAGEMENT MODULE (js/settings.js)
 
 * PURPOSE & UI RESPONSIBILITY:
 * This file is dedicated entirely to the "System Settings" page (#view-settings)
 * and managing user preferences across HighwayPulse.
 *
 * KEY FEATURES IMPLEMENTED IN THIS FILE:
 * 1. Interface Theme Configuration:
 *    - Switches between Light Mode (Default) and Dark Mode.
 *    - Synchronizes the Settings dropdown with the Topbar theme toggle icon.
 *    - Persists the active theme choice in browser LocalStorage.
 * 2. Navigation & Layout Preferences:
 *    - Default Landing Section (Overview, Map, Defects, Planner).
 *    - Default Defects Table Page Size (10, 25, 50 records per page).
 * 3. Transparent Prioritization Weights Reference:
 *    - Explains active mathematical weights: Severity (40%), Traffic (25%),
 *      Safety (25%), and Time Unresolved (10%).
 * 4. Data Backup & Reset Operations:
 *    - Download Full JSON Backup of all defects, tasks, and settings.
 *    - Restore Original Demonstration Dataset (resets to pristine 36-defect baseline).
 *
 * HOW TO STUDY THIS FILE:
 * - Study how `StorageService.getSettings()` and `StorageService.saveSettings()`
 *   persist key-value pairs without requiring an external database.
 * - Examine how DOM change events (`addEventListener('change')`) update application
 *   state dynamically across different modules without reloading the page.
 *
 * DEPENDENCIES:
 * - js/utils.js: For `Utils.showToast()` notifications and `Utils.downloadFile()`.
 * - js/storage.js: For `StorageService.getSettings()`, `saveSettings()`, and `resetToSampleData()`.
 * - js/dashboard.js, js/defects.js, js/planner.js, js/analytics.js, js/map.js: Refreshed on data reset.
 */

const SettingsModule = {
  /**
   * Initialize settings controls, attach event listeners, and populate form state
   */
  init() {
    this.populateCurrentSettings();
    this.setupEventListeners();
  },

  /**
   * Populate input controls with current stored user preferences
   */
  populateCurrentSettings() {
    const settings = StorageService.getSettings();

    // 1. Interface Theme Selector
    const themeSelect = document.getElementById('settings-theme-select');
    if (themeSelect) {
      themeSelect.value = settings.theme || 'light';
    }

    // 2. Default Landing Section Selector
    const defViewSelect = document.getElementById('settings-default-view');
    if (defViewSelect) {
      defViewSelect.value = settings.defaultView || 'overview';
    }

    // 3. Table Page Size Selector
    const pageSizeSelect = document.getElementById('settings-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.value = String(settings.pageSize || 10);
    }
  },

  /**
   * Set up change and click event listeners for the Settings view
   */
  setupEventListeners() {
    // A. Theme Selection Handler
    const themeSelect = document.getElementById('settings-theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        this.applyTheme(newTheme);
        Utils.showToast(`Theme updated to ${newTheme} mode`, 'success');
      });
    }

    // B. Default Landing Section Handler
    const defViewSelect = document.getElementById('settings-default-view');
    if (defViewSelect) {
      defViewSelect.addEventListener('change', (e) => {
        StorageService.saveSettings({ defaultView: e.target.value });
        Utils.showToast('Default view preference saved', 'success');
      });
    }

    // C. Default Table Page Size Handler
    const pageSizeSelect = document.getElementById('settings-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        StorageService.saveSettings({ pageSize: val });
        if (typeof DefectsModule !== 'undefined' && DefectsModule.state) {
          DefectsModule.state.pageSize = val;
          DefectsModule.state.currentPage = 1;
          DefectsModule.render();
        }
        Utils.showToast('Default page size updated to ' + val, 'success');
      });
    }

    // D. Reset Demonstration Sample Data Handler
    const resetBtn = document.getElementById('btn-reset-sample-data');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const confirmed = window.confirm(
          'Are you sure you want to restore the original fictional demonstration data?\n\n' +
          'This will overwrite locally added or edited defects and return the dashboard to its initial 36-defect baseline.'
        );
        if (confirmed) {
          StorageService.resetToSampleData();
          Utils.showToast('Original sample data successfully restored!', 'success');

          // Refresh all active application views
          if (typeof DashboardModule !== 'undefined') DashboardModule.init();
          if (typeof DefectsModule !== 'undefined') {
            DefectsModule.populateFilterDropdowns();
            DefectsModule.render();
          }
          if (typeof PlannerModule !== 'undefined') {
            PlannerModule.populateFilterDropdowns();
            PlannerModule.render();
          }
          if (typeof AnalyticsModule !== 'undefined') AnalyticsModule.render();
          if (typeof MapModule !== 'undefined') MapModule.refreshMarkers();
        }
      });
    }

    // E. Export Raw JSON Backup Handler
    const exportJsonBtn = document.getElementById('btn-export-raw-json');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => {
        const backup = {
          application: 'HighwayPulse',
          exportTimestamp: new Date().toISOString(),
          settings: StorageService.getSettings(),
          defects: StorageService.getDefects(),
          tasks: StorageService.getTasks(),
        };
        const jsonStr = JSON.stringify(backup, null, 2);
        const filename = `highwaypulse_backup_${new Date().toISOString().split('T')[0]}.json`;
        Utils.downloadFile(jsonStr, filename, 'application/json');
        Utils.showToast('Full JSON data backup downloaded', 'success');
      });
    }
  },

  /**
   * Apply a theme globally across document classes, toggle icons, and storage
   * @param {'light'|'dark'} themeName 
   */
  applyTheme(themeName) {
    if (themeName === 'light') {
      document.documentElement.classList.remove('dark-theme');
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
      document.documentElement.classList.add('dark-theme');
    }

    // Persist choice to storage
    StorageService.saveSettings({ theme: themeName });

    // Sync dropdown in settings if changed from topbar
    const themeSelect = document.getElementById('settings-theme-select');
    if (themeSelect) themeSelect.value = themeName;

    // Sync topbar button icon via App helper
    if (typeof App !== 'undefined' && App.updateThemeButtonIcon) {
      App.updateThemeButtonIcon(themeName === 'light');
    }

    // Refresh chart canvas styling
    if (typeof DashboardModule !== 'undefined') DashboardModule.renderCharts();
    if (typeof AnalyticsModule !== 'undefined') AnalyticsModule.render();
  }
};
