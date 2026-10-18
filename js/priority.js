/**
 * HIGHWAYPULSE — MULTI-CRITERIA PRIORITIZATION ENGINE (js/priority.js)
 
 * PURPOSE & UI RESPONSIBILITY:
 * Encapsulates the core mathematical scoring logic of the dashboard.
 * Takes 4 multi-criteria ratings (0-100), applies weighting factors,
 * calculates the composite Priority Score, assigns category tiers, and renders
 * accessible color-coded badges used across tables, maps, and detail modals.
 *
 * MATHEMATICAL HEURISTIC FORMULA:
 * Priority Score = (Severity * 0.40) + (Traffic Exposure * 0.25) + (Safety Risk * 0.25) + (Time Unresolved * 0.10)
 *
 * OPERATIONAL CLASSIFICATION THRESHOLDS:
 * - Critical: 80 – 100 (Immediate hazard requiring rapid barricading / repair)
 * - High:     60 – 79  (Significant distress requiring scheduled repair within 7 days)
 * - Medium:   35 – 59  (Developing distress placed in standard maintenance queue)
 * - Low:      0 – 34   (Minor cosmetic distress monitored during routine patrols)
 *
 * KEY FEATURES IMPLEMENTED IN THIS FILE:
 * 1. `calculate(severity, traffic, safety, timeUnresolved)`:
 *    - Clamps inputs safely between 0 and 100.
 *    - Computes raw score (unrounded decimal) and display score (rounded integer).
 *    - Generates a full factor breakdown object with exact point contributions.
 * 2. `getCategory(score)`: Maps numerical score to tier label.
 * 3. `renderBadge(category, score)`:
 *    - Renders accessible Zero-Pill badges with shape symbols (▲, ■, ◆, ●)
 *      to ensure readability for users with color-vision deficiencies.
 * 4. `renderStatusBadge(status)`:
 *    - Renders status indicators (Open, Under Review, In Progress, Resolved).
 *
 * MANDATORY EDUCATIONAL DISCLAIMER:
 * This formula is an illustrative educational heuristic created for this portfolio prototype.
 * It is not an official NHAI formula, engineering standard, approved safety assessment,
 * or validated accident prediction model. Never describe its output as an official engineering decision.
 */

const PrioritySystem = {
  // Current active weights (default sum = 1.0)
  weights: {
    severity: 0.40,
    traffic: 0.25,
    safety: 0.25,
    time: 0.10,
  },

  disclaimer:
    'This formula is an illustrative educational heuristic created for the HighwayPulse prototype. ' +
    'It does not constitute an official NHAI specification, certified safety assessment, or engineering standard.',

  /**
   * Clamp an input value between min and max (default 0 to 100)
   * @param {number} val 
   * @param {number} min 
   * @param {number} max 
   * @returns {number}
   */
  clamp(val, min = 0, max = 100) {
    const num = Number(val);
    if (isNaN(num)) return 0;
    return Math.max(min, Math.min(max, num));
  },

  /**
   * Calculate unrounded and rounded priority score
   * @param {number} severity - 0 to 100
   * @param {number} traffic - 0 to 100
   * @param {number} safety - 0 to 100
   * @param {number} timeUnresolved - 0 to 100
   * @returns {{ rawScore: number, displayScore: number, category: string, breakdown: object }}
   */
  calculate(severity, traffic, safety, timeUnresolved) {
    const s = this.clamp(severity);
    const t = this.clamp(traffic);
    const r = this.clamp(safety);
    const u = this.clamp(timeUnresolved);

    const severityPart = s * this.weights.severity;
    const trafficPart = t * this.weights.traffic;
    const safetyPart = r * this.weights.safety;
    const timePart = u * this.weights.time;

    const rawScore = severityPart + trafficPart + safetyPart + timePart;
    const displayScore = Math.min(100, Math.max(0, Math.round(rawScore)));
    const category = this.getCategory(displayScore);

    return {
      rawScore: Number(rawScore.toFixed(2)),
      displayScore,
      category,
      breakdown: {
        severity: { input: s, weight: this.weights.severity, contribution: Number(severityPart.toFixed(2)) },
        traffic: { input: t, weight: this.weights.traffic, contribution: Number(trafficPart.toFixed(2)) },
        safety: { input: r, weight: this.weights.safety, contribution: Number(safetyPart.toFixed(2)) },
        time: { input: u, weight: this.weights.time, contribution: Number(timePart.toFixed(2)) },
      },
    };
  },

  /**
   * Determine priority category from score
   * @param {number} score 
   * @returns {'Critical' | 'High' | 'Medium' | 'Low'}
   */
  getCategory(score) {
    if (score >= 80) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 35) return 'Medium';
    return 'Low';
  },

  /**
   * Get CSS class name for priority category
   * @param {string} category 
   * @returns {string}
   */
  getBadgeClass(category) {
    switch (String(category).toLowerCase()) {
      case 'critical':
        return 'badge-critical';
      case 'high':
        return 'badge-high';
      case 'medium':
        return 'badge-medium';
      case 'low':
      default:
        return 'badge-low';
    }
  },

  /**
   * Render an accessible priority badge with text, score, and symbol
   * @param {string} category 
   * @param {number} score 
   * @returns {string} HTML string
   */
  renderBadge(category, score) {
    const cleanCat = Utils.escapeHtml(category);
    const badgeClass = this.getBadgeClass(category);
    const scoreText = score !== undefined && score !== null ? ` (${Math.round(score)})` : '';
    let symbol = '●';
    if (category === 'Critical') symbol = '▲';
    else if (category === 'High') symbol = '■';
    else if (category === 'Medium') symbol = '◆';

    return `<span class="priority-badge ${badgeClass}" title="Priority ${cleanCat}${scoreText}"><span class="badge-symbol">${symbol}</span> ${cleanCat}${scoreText}</span>`;
  },

  /**
   * Render a status badge
   * @param {string} status 
   * @returns {string} HTML string
   */
  renderStatusBadge(status) {
    const cleanStatus = Utils.escapeHtml(status);
    let css = 'status-open';
    const s = String(status).toLowerCase();
    if (s === 'resolved' || s === 'completed') css = 'status-resolved';
    else if (s === 'in progress') css = 'status-progress';
    else if (s === 'under review' || s === 'scheduled') css = 'status-review';
    else if (s === 'on hold') css = 'status-hold';

    return `<span class="status-badge ${css}"><span class="status-dot"></span>${cleanStatus}</span>`;
  }
};
