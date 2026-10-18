/**
 * HIGHWAYPULSE — UTILITY FUNCTIONS & COMMON HELPERS (js/utils.js)
 
 * PURPOSE & UI RESPONSIBILITY:
 * Reusable utility methods called across all dashboard views and modules.
 * Handles text sanitization, date/number formatting, unique ID generation,
 * spreadsheet-safe CSV exports, and animated toast notifications.
 *
 * KEY FEATURES IMPLEMENTED IN THIS FILE:
 * 1. Security & Sanitization (`escapeHtml`):
 *    - Prevents Cross-Site Scripting (XSS) by encoding characters (<, >, &, ", ')
 *      before untrusted user inputs are rendered into the DOM.
 * 2. Date & Time Utilities (`formatDate`, `daysElapsed`):
 *    - Formats ISO date strings to human-readable Indian format (e.g., "14 Oct 2026").
 *    - Computes elapsed dwell time (in days) between reported date and today.
 * 3. Number Formatting (`formatNumber`):
 *    - Formats numbers with locale separators (e.g., 1,420).
 * 4. Identifier Generators (`generateDefectId`, `generateTaskId`):
 *    - Deterministically generates sequential IDs: DEF-YYYY-XXXX and TSK-YYYY-XXX.
 * 5. Safe CSV Generation (`escapeCsvCell`, `downloadFile`):
 *    - Escapes commas, quotes, and newlines per RFC 4180.
 *    - Mitigates CSV Formula Injection by neutralising formula triggers (=, +, -, @).
 *    - Triggers automated browser file downloads via temporary Blobs.
 * 6. User Feedback (`showToast`):
 *    - Renders accessible toast notification badges (success, error, warning, info).
 *
 * HOW TO STUDY THIS FILE:
 * - Start here! This is the lowest-level dependency loaded first in index.html.
 * - Study `escapeHtml` to understand how to prevent malicious HTML injection.
 * - Study `escapeCsvCell` to learn how spreadsheets handle delimiter escaping.
 */

const Utils = {
  /**
   * Escape untrusted text to prevent HTML injection (XSS)
   * @param {string|number} str - Untrusted string
   * @returns {string} Sanitized string safe for innerHTML insertion
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const text = String(str);
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  },

  /**
   * Format a date string into readable local format (e.g. "14 Oct 2026")
   * @param {string|Date} dateStr - Date string or Date instance
   * @returns {string} Formatted date
   */
  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return String(dateStr);
    }
  },

  /**
   * Calculate elapsed days from a date string to today
   * @param {string} dateStr 
   * @returns {number} Days elapsed (minimum 0)
   */
  daysElapsed(dateStr) {
    if (!dateStr) return 0;
    const start = new Date(dateStr);
    if (isNaN(start.getTime())) return 0;
    const today = new Date();
    const diffTime = Math.max(0, today.getTime() - start.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Format a number with optional decimals and separators
   * @param {number} num 
   * @param {number} decimals 
   * @returns {string}
   */
  formatNumber(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  },

  /**
   * Generate unique defect ID (e.g. DEF-2026-1042)
   * @param {Array} existingRecords 
   * @returns {string}
   */
  generateDefectId(existingRecords = []) {
    const year = new Date().getFullYear();
    const maxNumber = existingRecords.reduce((max, item) => {
      if (item && item.id && item.id.startsWith('DEF-')) {
        const parts = item.id.split('-');
        const seq = parseInt(parts[2], 10);
        return !isNaN(seq) && seq > max ? seq : max;
      }
      return max;
    }, 1000);
    return `DEF-${year}-${maxNumber + 1}`;
  },

  /**
   * Generate unique maintenance task ID (e.g. TSK-2026-101)
   * @param {Array} existingTasks 
   * @returns {string}
   */
  generateTaskId(existingTasks = []) {
    const year = new Date().getFullYear();
    const maxNumber = existingTasks.reduce((max, item) => {
      if (item && item.id && item.id.startsWith('TSK-')) {
        const parts = item.id.split('-');
        const seq = parseInt(parts[2], 10);
        return !isNaN(seq) && seq > max ? seq : max;
      }
      return max;
    }, 100);
    return `TSK-${year}-${maxNumber + 1}`;
  },

  /**
   * Safe CSV cell escaping to prevent CSV formula injection and delimiter corruption
   * Handles commas, quotes, newlines, and leading formula triggers (=, +, -, @)
   * @param {*} value 
   * @returns {string}
   */
  escapeCsvCell(value) {
    if (value === null || value === undefined) return '""';
    let str = String(value);

    // Prevent formula injection in spreadsheet software
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }

    // Escape quotes by doubling them
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  },

  /**
   * Trigger browser file download from string content
   * @param {string} content 
   * @param {string} filename 
   * @param {string} mimeType 
   */
  downloadFile(content, filename, mimeType = 'text/csv;charset=utf-8;') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Simple toast notification
   * @param {string} message 
   * @param {'success'|'error'|'info'|'warning'} type 
   */
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span class="toast-message">${Utils.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 300);
    }, 3500);
  },

  /**
   * Helper to truncate string
   * @param {string} str 
   * @param {number} length 
   */
  truncate(str, length = 30) {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '…' : str;
  }
};
