/**
 * HIGHWAYPULSE — GEOGRAPHIC HIGHWAY MAP MODULE (js/map.js)

 * PURPOSE & UI RESPONSIBILITY:
 * This file powers the interactive geospatial map (#view-map) displaying defect
 * locations across Indian National Highway corridors (NH 44, NH 48, NH 16, NH 27, etc.)
 * using Leaflet.js and OpenStreetMap cartographic tiles.
 *
 * KEY FEATURES IMPLEMENTED IN THIS FILE:
 * 1. Interactive GIS Canvas:
 *    - Renders pan/zoom vector map centered geographically over the Indian subcontinent.
 *    - Custom color-coded SVG pin markers corresponding directly to defect priority tiers:
 *      * Red: Critical Hazards (Score 80–100)
 *      * Orange: High Priority (Score 60–79)
 *      * Blue: Medium Priority (Score 35–59)
 *      * Slate/Gray: Low Priority (Score 0–34)
 * 2. Geo-Marker Filtering:
 *    - Map Toolbar filters pins dynamically by Priority and Status without map reloads.
 * 3. Rich Interactive Popups:
 *    - Clicking any pin displays Defect ID, Corridor, Chainage Marker, Priority Score badge,
 *      and a direct link to open the full inspection modal.
 * 4. Fault-Tolerant Offline Fallback:
 *    - If CDN fails, browser is offline, or WebGL/Leaflet is unavailable, the module
 *      gracefully renders an accessible tabular listing of geographic coordinates
 *      instead of throwing unhandled exceptions or presenting a blank screen.
 * 5. Automatic Viewport Resize Handling:
 *    - Invokes `mapInstance.invalidateSize()` whenever switching views or resizing the window
 *      to prevent map clipping or gray tile syndrome.
 *
 * HOW TO STUDY THIS FILE:
 * - Study `initializeMap()` to learn how Leaflet `L.map()` and `L.tileLayer()` work in vanilla JS.
 * - Inspect `createCustomIcon(priority)` to see how inline SVG data URIs create crisp,
 *   resolution-independent map markers.
 * - Examine `renderFallback()` to observe defensive programming and offline fallback design.
 *
 * DEPENDENCIES:
 * - Leaflet CDN (L object) or graceful degradation fallback table.
 * - js/utils.js: For `Utils.escapeHtml()`.
 * - js/storage.js: For `StorageService.getDefects()`.
 * - js/defects.js: For `DefectsModule.openDetailModal()`.
 */

const MapModule = {
  mapInstance: null,
  markersLayer: null,
  isInitialized: false,
  activeFilterPriority: 'all',
  activeFilterStatus: 'all',

  init() {
    this.setupFilterControls();

    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
      this.renderFallback('Leaflet mapping library is currently unavailable or offline.');
      return;
    }

    try {
      this.initializeMap();
    } catch (err) {
      console.error('HighwayPulse: Map initialization error', err);
      this.renderFallback('Unable to initialize map view. Please check network connection.');
    }
  },

  initializeMap() {
    const mapContainer = document.getElementById('highway-map');
    if (!mapContainer) return;

    if (this.mapInstance) {
      this.refreshMarkers();
      setTimeout(() => this.mapInstance.invalidateSize(), 150);
      return;
    }

    // Default center: Central India highway corridor view
    const initialCenter = [21.5, 78.9];
    const initialZoom = 5;

    this.mapInstance = L.map('highway-map', {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: true,
    });

    // Add OpenStreetMap tile layer with error handling
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors | Illustrative Prototype Data',
      maxZoom: 19,
    });

    tileLayer.on('tileerror', () => {
      const banner = document.getElementById('map-status-banner');
      if (banner) {
        banner.style.display = 'block';
        banner.textContent = 'Notice: Map tile network is experiencing latency. Marker coordinates remain accurate.';
      }
    });

    tileLayer.addTo(this.mapInstance);

    this.markersLayer = L.layerGroup().addTo(this.mapInstance);
    this.refreshMarkers();
    this.isInitialized = true;

    // Resize recalculation
    window.addEventListener('resize', () => {
      if (this.mapInstance) this.mapInstance.invalidateSize();
    });
  },

  setupFilterControls() {
    const prioritySelect = document.getElementById('map-filter-priority');
    if (prioritySelect) {
      prioritySelect.addEventListener('change', (e) => {
        this.activeFilterPriority = e.target.value;
        this.refreshMarkers();
      });
    }

    const statusSelect = document.getElementById('map-filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.activeFilterStatus = e.target.value;
        this.refreshMarkers();
      });
    }

    const resetBtn = document.getElementById('btn-reset-map-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.activeFilterPriority = 'all';
        this.activeFilterStatus = 'all';
        if (prioritySelect) prioritySelect.value = 'all';
        if (statusSelect) statusSelect.value = 'all';
        this.refreshMarkers();
        if (this.mapInstance) {
          this.mapInstance.setView([21.5, 78.9], 5);
        }
        Utils.showToast('Map filters reset', 'info');
      });
    }
  },

  /**
   * Create custom SVG icon for marker based on priority category
   */
  createMarkerIcon(priority) {
    let color = '#64748b'; // Low
    if (priority === 'Critical') color = '#dc2626';
    else if (priority === 'High') color = '#ea580c';
    else if (priority === 'Medium') color = '#2563eb';

    const svgIcon = `
      <svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 38 14 38C14 38 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="${color}"/>
        <circle cx="14" cy="14" r="6" fill="#ffffff"/>
      </svg>
    `;

    return L.divIcon({
      className: 'custom-leaflet-marker',
      html: svgIcon,
      iconSize: [28, 38],
      iconAnchor: [14, 38],
      popupAnchor: [0, -34],
    });
  },

  /**
   * Repopulate markers based on current storage and filter settings
   */
  refreshMarkers() {
    if (!this.mapInstance || !this.markersLayer) return;

    this.markersLayer.clearLayers();
    const defects = StorageService.getDefects();

    let visibleCount = 0;

    defects.forEach(d => {
      if (!d.latitude || !d.longitude) return;

      // Filter check
      if (this.activeFilterPriority !== 'all' && d.priority !== this.activeFilterPriority) return;
      if (this.activeFilterStatus !== 'all' && d.status !== this.activeFilterStatus) return;

      const marker = L.marker([d.latitude, d.longitude], {
        icon: this.createMarkerIcon(d.priority),
        title: `${d.id}: ${d.road}`,
      });

      const popupContent = `
        <div class="map-popup-card">
          <div class="flex justify-between items-center mb-1">
            <strong class="text-sm font-bold">${Utils.escapeHtml(d.id)}</strong>
            ${PrioritySystem.renderBadge(d.priority, d.priorityScore)}
          </div>
          <div class="text-xs font-semibold text-navy mt-1">${Utils.escapeHtml(d.road)}</div>
          <div class="text-xs text-muted mb-2">${Utils.escapeHtml(d.location)}</div>
          <div class="text-xs mb-2"><strong>Category:</strong> ${Utils.escapeHtml(d.category)}</div>
          <div class="text-xs mb-2"><strong>Status:</strong> ${PrioritySystem.renderStatusBadge(d.status)}</div>
          <div class="pt-2 border-t text-right">
            <button class="btn btn-xs btn-primary" onclick="DefectsModule.openDetailModal('${Utils.escapeHtml(d.id)}')">
              Inspect Defect Details
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      this.markersLayer.addLayer(marker);
      visibleCount++;
    });

    const countBadge = document.getElementById('map-visible-count');
    if (countBadge) {
      countBadge.textContent = `${visibleCount} Defect Markers Placed`;
    }
  },

  /**
   * Pan to specific coordinates and open popup
   */
  focusLocation(lat, lng, defectId) {
    if (!this.mapInstance) return;
    this.mapInstance.setView([lat, lng], 14, { animate: true });

    // Open popup after map tiles shift
    setTimeout(() => {
      if (!this.markersLayer) return;
      this.markersLayer.eachLayer(layer => {
        if (layer.getLatLng && Math.abs(layer.getLatLng().lat - lat) < 0.001) {
          layer.openPopup();
        }
      });
    }, 400);
  },

  /**
   * Graceful fallback when Leaflet is not available
   */
  renderFallback(reason) {
    const container = document.getElementById('highway-map');
    if (!container) return;

    const defects = StorageService.getDefects();

    container.innerHTML = `
      <div class="map-fallback-panel">
        <div class="map-fallback-header">
          <div class="font-bold text-base text-navy">Interactive Map Fallback Mode</div>
          <p class="text-xs text-muted">${Utils.escapeHtml(reason)} A live internet connection is required to load CDN map tiles.</p>
        </div>
        <div class="map-fallback-body">
          <p class="text-xs text-slate mb-3">All geographic defect locations remain accessible in this local tabular view:</p>
          <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Corridor</th>
                  <th>Location Marker</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${defects.map(d => `
                  <tr>
                    <td><strong>${Utils.escapeHtml(d.id)}</strong></td>
                    <td class="text-xs">${Utils.escapeHtml(d.road)}</td>
                    <td class="text-xs">${Utils.escapeHtml(d.location)}</td>
                    <td class="font-mono text-xs">${d.latitude || 'N/A'}</td>
                    <td class="font-mono text-xs">${d.longitude || 'N/A'}</td>
                    <td>${PrioritySystem.renderBadge(d.priority, d.priorityScore)}</td>
                    <td>${PrioritySystem.renderStatusBadge(d.status)}</td>
                    <td>
                      <button class="btn btn-xs btn-outline" onclick="DefectsModule.openDetailModal('${Utils.escapeHtml(d.id)}')">
                        Inspect
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
};
