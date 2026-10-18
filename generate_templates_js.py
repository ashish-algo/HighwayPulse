import os
import re

os.makedirs('templates', exist_ok=True)

files = [
    ('sidebar', 'templates/sidebar.html'),
    ('topbar', 'templates/topbar.html'),
    ('overview', 'templates/view-overview.html'),
    ('map', 'templates/view-map.html'),
    ('defects', 'templates/view-defects.html'),
    ('report', 'templates/view-report.html'),
    ('planner', 'templates/view-planner.html'),
    ('analytics', 'templates/view-analytics.html'),
    ('settings', 'templates/view-settings.html'),
    ('about', 'templates/view-about.html'),
    ('modals', 'templates/modals.html')
]

templates = {}
for key, filepath in files:
    with open(filepath) as f:
        content = f.read()
    clean_html = re.sub(r'<!--[\s\S]*?-->\s*', '', content, count=1).strip()
    templates[key] = clean_html

import json

def to_js_str(val):
    return json.dumps(val)

js_content = f'''/**
 * ============================================================================
 * HIGHWAYPULSE — TEMPLATE LOADER & COMPONENT REGISTRY (js/templates.js)
 * ============================================================================
 *
 * PURPOSE & UI RESPONSIBILITY:
 * This file coordinates and manages modular HTML view components and templates
 * across the HighwayPulse application.
 *
 * MODULAR ARCHITECTURE (SEPARATE FILES FOR EVERY PART):
 * Instead of keeping all HTML in a single 1,000-line index.html, every feature
 * and view is maintained in its own dedicated, clean file in the /templates folder:
 *   - templates/sidebar.html       : Navigation drawer, links, and ZIP download button
 *   - templates/topbar.html        : Header with search, alert notifications, theme switch
 *   - templates/view-overview.html : Executive summary dashboard & KPI metric cards
 *   - templates/view-map.html      : Leaflet GIS map with corridor pills & defect cards
 *   - templates/view-defects.html  : Full-text search and filterable defect data table
 *   - templates/view-report.html   : Intake wizard with GPS picker and live score preview
 *   - templates/view-planner.html  : Kanban work order board & crew scheduling table
 *   - templates/view-analytics.html: Statistical charts, risk matrix, and cost analysis
 *   - templates/view-settings.html : Heuristic weights, backup/restore, and project ZIP
 *   - templates/view-about.html    : Engineering formulas, priority matrix & SLA benchmarks
 *   - templates/modals.html        : Defect detail inspector & work order modal dialogs
 *
 * KEY FEATURES IMPLEMENTED IN THIS FILE:
 * 1. Single-Point Template Mounting:
 *    - Injects components into index.html mount points (#sidebar-container,
 *      #topbar-container, #app-stage, #modals-container) upon application boot.
 * 2. Standalone & Offline Compatibility:
 *    - Keeps index.html lean (<80 lines) while guaranteeing zero CORS errors
 *      when running from local file:// URLs or offline static environments.
 * 3. Individual Template Access:
 *    - Exposes each template via `Templates.<viewName>` for programmatic re-rendering
 *      or targeted inspection.
 *
 * HOW TO STUDY THIS CODE:
 * - Inspect the individual templates in the /templates directory to see clean HTML
 *   markup for each feature with dedicated educational header comments.
 * - Review `Templates.renderAll()` below to see how modular SPA components are
 *   assembled cleanly before view controllers initialize.
 * ============================================================================
 */

const Templates = {{
  isRendered: false,

  sidebar: {to_js_str(templates['sidebar'])},

  topbar: {to_js_str(templates['topbar'])},

  overview: {to_js_str(templates['overview'])},

  map: {to_js_str(templates['map'])},

  defects: {to_js_str(templates['defects'])},

  report: {to_js_str(templates['report'])},

  planner: {to_js_str(templates['planner'])},

  analytics: {to_js_str(templates['analytics'])},

  settings: {to_js_str(templates['settings'])},

  about: {to_js_str(templates['about'])},

  modals: {to_js_str(templates['modals'])},

  /**
   * Mounts all modular templates into their designated index.html container targets.
   * Executed prior to module initialization to ensure all DOM selectors exist.
   */
  renderAll() {{
    if (this.isRendered) return;

    // 1. Mount Sidebar Navigation
    const sidebarEl = document.getElementById('sidebar-container');
    if (sidebarEl) {{
      sidebarEl.outerHTML = this.sidebar;
    }}

    // 2. Mount Topbar Header
    const topbarEl = document.getElementById('topbar-container');
    if (topbarEl) {{
      topbarEl.outerHTML = this.topbar;
    }}

    // 3. Mount All Application View Sections into the Main Stage
    const stageEl = document.getElementById('app-stage');
    if (stageEl) {{
      stageEl.innerHTML = [
        this.overview,
        this.map,
        this.defects,
        this.report,
        this.planner,
        this.analytics,
        this.settings,
        this.about
      ].join('\\n\\n');
    }}

    // 4. Mount Application Modal Dialogs
    const modalsEl = document.getElementById('modals-container');
    if (modalsEl) {{
      modalsEl.innerHTML = this.modals;
    }}

    this.isRendered = true;
    console.log('HighwayPulse: All modular view templates rendered successfully into DOM.');
  }}
}};

// Auto-execute rendering immediately if DOM is already parsed
if (document.readyState === 'interactive' || document.readyState === 'complete') {{
  Templates.renderAll();
}} else {{
  document.addEventListener('DOMContentLoaded', () => {{
    Templates.renderAll();
  }}, {{ once: true }});
}}
'''

with open('js/templates.js', 'w') as out:
    out.write(js_content)

print('js/templates.js successfully generated!')
