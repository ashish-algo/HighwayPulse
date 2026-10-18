/**
 * HIGHWAYPULSE — APPLICATION CORE CONTROLLER & VIEW ROUTER (js/app.js)

 * PURPOSE & UI RESPONSIBILITY:
 * This file is the central orchestrator and bootstrap coordinator for the
 * entire HighwayPulse single-page application (SPA).
 *
 * KEY FEATURES IMPLEMENTED IN THIS FILE:
 * 1. Application Lifecycle & Startup:
 *    - Bootstraps all feature modules in strict sequence on DOMContentLoaded.
 *    - Initializes system date in the topbar header.
 * 2. Client-Side Single-Page Routing (SPA):
 *    - Switches views (#view-overview, #view-map, #view-defects, #view-report,
 *      #view-planner, #view-analytics, #view-settings, #view-about) dynamically
 *      without browser page reloads.
 *    - Updates page titles, breadcrumbs, and active sidebar link indicators.
 * 3. Responsive Shell & Navigation Drawer:
 *    - Manages mobile/tablet slide-out drawer navigation (openSidebar, closeSidebar, toggleSidebar).
 *    - Connects dark backdrop overlay (#sidebar-backdrop) for tap-to-dismiss functionality.
 *    - Automatically closes drawer on viewport resize or on navigation selection.
 * 4. Top Navigation Bar Events:
 *    - Global Search input: Pressing Enter navigates directly to Defect Management
 *      with the search query pre-filtered.
 *    - Operations Alert Feed: Bell icon dropdown displaying critical safety
 *      hazards and overdue maintenance work orders.
 *    - Theme Toggle Quick Action: Swaps between Light Mode (Default) and Dark Mode.
 *
 * HOW TO STUDY THIS FILE:
 * - Study `navigateTo(viewName)` to understand how single-page navigation is
 *   achieved in pure Vanilla JavaScript by toggling CSS classes (`.view-active`).
 * - Review `setupTopbarControls()` to see how event listeners bind global UI elements.
 *
 * DEPENDENCIES:
 * - js/utils.js, js/storage.js, js/settings.js, js/templates.js
 * - All view controllers: DashboardModule, DefectsModule, FormModule, PlannerModule,
 *   AnalyticsModule, MapModule, SettingsModule.
 */

const App = {
  currentView: 'overview',

  init() {
    try {
      console.log('HighwayPulse: Initializing highway monitoring application...');

      // 0. Render modular component templates into DOM
      if (typeof Templates !== 'undefined') {
        Templates.renderAll();
      }

      // 1. Apply user settings (Theme, default view, etc.)
      this.applySavedSettings();

      // 2. Setup SPA Navigation
      this.setupNavigation();

      // 3. Setup Top Navigation Bar actions (Search, Theme toggle, Mobile Menu)
      this.setupTopbarControls();

      // 4. Setup Settings View actions via dedicated SettingsModule
      if (typeof SettingsModule !== 'undefined') {
        SettingsModule.init();
      }

      // 5. Initialize Module Views
      DashboardModule.init();
      DefectsModule.init();
      FormModule.init();
      PlannerModule.init();
      AnalyticsModule.init();

      // 6. Initialize Map (deferred slightly for proper DOM layout)
      setTimeout(() => {
        MapModule.init();
      }, 200);

      console.log('HighwayPulse: All modules initialized successfully.');
    } catch (err) {
      console.error('HighwayPulse Initialization Error:', err);
      Utils.showToast('Application initialized with warnings: ' + err.message, 'warning');
    }
  },

  applySavedSettings() {
    const settings = StorageService.getSettings();

    // Apply theme
    if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark-theme');
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
      document.documentElement.classList.add('dark-theme');
    }

    const themeToggleBtn = document.getElementById('btn-theme-toggle');
    if (themeToggleBtn) {
      this.updateThemeButtonIcon(settings.theme === 'light');
    }

    // Set default page size in defects module
    if (settings.pageSize && DefectsModule.state) {
      DefectsModule.state.pageSize = settings.pageSize;
    }

    // If default view was stored, navigate to it
    if (settings.defaultView && settings.defaultView !== 'overview') {
      this.navigateTo(settings.defaultView);
    }
  },

  updateThemeButtonIcon(isLight) {
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;
    btn.innerHTML = isLight
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  },

  openSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.add('sidebar-open');
    if (backdrop) backdrop.classList.add('active');
  },

  closeSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('sidebar-open');
    if (backdrop) backdrop.classList.remove('active');
  },

  toggleSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && sidebar.classList.contains('sidebar-open')) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  },

  setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = link.getAttribute('data-view');
        if (targetView) {
          this.navigateTo(targetView);
          // On mobile & tablet, close drawer after navigation
          if (window.innerWidth <= 1024) {
            this.closeSidebar();
          }
        }
      });
    });

    // Close modal on click outside or on close buttons
    document.querySelectorAll('.modal-backdrop, .btn-close-modal').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el || el.classList.contains('btn-close-modal')) {
          document.querySelectorAll('.modal.modal-open').forEach(m => m.classList.remove('modal-open'));
        }
      });
    });

    // Escape key closes modals, dropdowns, and mobile sidebar
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.modal-open').forEach(m => m.classList.remove('modal-open'));
        const alertDropdown = document.getElementById('alerts-dropdown');
        if (alertDropdown) alertDropdown.classList.remove('dropdown-open');
        this.closeSidebar();
      }
    });
  },

  navigateTo(viewName) {
    const targetSection = document.getElementById(`view-${viewName}`);
    if (!targetSection) {
      console.warn(`View "view-${viewName}" not found.`);
      return;
    }

    // Hide all views
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('view-active');
    });

    // Show target view
    targetSection.classList.add('view-active');
    this.currentView = viewName;

    // Update active nav link
    document.querySelectorAll('.sidebar-nav-link').forEach(link => {
      if (link.getAttribute('data-view') === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update topbar title
    const titles = {
      overview: { title: 'Overview Dashboard', sub: 'Corridor Safety & Defect Monitoring' },
      map: { title: 'Highway Geographic Map', sub: 'Interactive GIS Defect Visualization' },
      defects: { title: 'Defect Management', sub: 'Inspection Records, Triage & Prioritization' },
      report: { title: 'Report Highway Defect', sub: 'Log New Field Observation' },
      planner: { title: 'Maintenance Planner', sub: 'Work Orders, Crew Allocation & Schedules' },
      analytics: { title: 'Analytics & Reports', sub: 'Data Aggregations, Rankings & Audits' },
      settings: { title: 'System Settings', sub: 'Preferences, Formula Weights & Data Reset' },
      about: { title: 'About HighwayPulse', sub: 'Portfolio System Architecture & Documentation' },
    };

    const info = titles[viewName] || { title: 'HighwayPulse', sub: '' };
    const pageTitleEl = document.getElementById('page-title-text');
    const pageSubEl = document.getElementById('page-subtitle-text');
    if (pageTitleEl) pageTitleEl.textContent = info.title;
    if (pageSubEl) pageSubEl.textContent = info.sub;

    // View specific triggers
    if (viewName === 'map' && MapModule.mapInstance) {
      setTimeout(() => {
        MapModule.mapInstance.invalidateSize();
        MapModule.refreshMarkers();
      }, 100);
    } else if (viewName === 'overview') {
      DashboardModule.init();
    } else if (viewName === 'defects') {
      DefectsModule.render();
    } else if (viewName === 'planner') {
      PlannerModule.render();
    } else if (viewName === 'analytics') {
      AnalyticsModule.render();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  setupTopbarControls() {
    // Quick search in top bar
    const topSearch = document.getElementById('topbar-search-input');
    if (topSearch) {
      topSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const query = topSearch.value.trim();
          if (query) {
            this.navigateTo('defects');
            const defectSearch = document.getElementById('defect-search-input');
            if (defectSearch) {
              defectSearch.value = query;
              DefectsModule.state.search = query.toLowerCase();
              DefectsModule.state.currentPage = 1;
              DefectsModule.render();
            }
          }
        }
      });
    }

    // Theme toggle button
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isCurrentlyLight = document.documentElement.classList.contains('light-theme');
        const newTheme = isCurrentlyLight ? 'dark' : 'light';

        if (typeof SettingsModule !== 'undefined') {
          SettingsModule.applyTheme(newTheme);
        } else {
          StorageService.saveSettings({ theme: newTheme });
          this.updateThemeButtonIcon(newTheme === 'light');
        }

        Utils.showToast(`Switched to ${newTheme} theme`, 'info');
      });
    }

    // Mobile sidebar toggle button & backdrop overlay
    const menuBtn = document.getElementById('btn-mobile-menu');
    const sidebarClose = document.getElementById('btn-close-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (menuBtn) {
      menuBtn.addEventListener('click', () => this.toggleSidebar());
    }

    if (sidebarClose) {
      sidebarClose.addEventListener('click', () => this.closeSidebar());
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => this.closeSidebar());
    }

    // Auto close sidebar on resize to desktop & refresh Leaflet map / charts
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) {
        this.closeSidebar();
      }
      if (typeof MapModule !== 'undefined' && MapModule.mapInstance) {
        MapModule.mapInstance.invalidateSize();
      }
    });

  },

  setupSettingsView() {
    if (typeof SettingsModule !== 'undefined') {
      SettingsModule.init();
    }
  }
};

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
