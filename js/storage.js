/**
 * HIGHWAYPULSE — LOCALSTORAGE PERSISTENCE & DATA ACCESS LAYER (js/storage.js)

 * PURPOSE & UI RESPONSIBILITY:
 * Manages client-side browser persistence for defect inspection records,
 * maintenance work orders, and user settings without requiring a database backend.
 * Provides defensive error handling with a transparent in-memory fallback.
 *
 * KEY FEATURES IMPLEMENTED IN THIS FILE:
 * 1. Storage Availability & Health Check (`isStorageAvailable`):
 *    - Verifies whether window.localStorage is accessible and writable
 *      (handles private browsing restrictions and quota limits).
 * 2. Defect CRUD Operations:
 *    - `getDefects()`: Retrieves and parses stored records; auto-initializes with SampleData.
 *    - `saveDefects(list)`: Serializes array to JSON and writes to storage.
 *    - `addDefect(record)`: Unshifts a new defect to the front of the list.
 *    - `updateDefect(id, updates)`: Modifies fields and automatically re-calculates
 *      priority scores if any evaluation factor was updated.
 *    - `deleteDefect(id)`: Removes record by unique ID.
 * 3. Maintenance Task CRUD Operations:
 *    - `getTasks()`, `saveTasks()`, `addTask()`, `updateTask()`, `deleteTask()`.
 * 4. User Settings Persistence:
 *    - `getSettings()`, `saveSettings()`: Stores theme preference, default page size,
 *      and default landing section.
 * 5. Reset Capability:
 *    - `resetToSampleData()`: Overwrites current local storage with original sample dataset.
 * 6. Fault-Tolerant In-Memory Fallback (`memoryFallback`):
 *    - If localStorage throws a SecurityError or QuotaExceededError, storage operations
 *      seamlessly switch to an in-memory session object so the dashboard never crashes.
 *
 * HOW TO STUDY THIS FILE:
 * - Study how try/catch blocks guard `JSON.parse` and `localStorage.setItem`.
 * - Notice how `updateDefect` invokes `PrioritySystem.calculate()` to keep derived
 *   priority scores in sync with underlying ratings.* 
 */

const StorageService = {
  KEYS: {
    DEFECTS: 'highwaypulse_defects_v1',
    TASKS: 'highwaypulse_tasks_v1',
    SETTINGS: 'highwaypulse_settings_v2',
  },

  // In-memory fallback if localStorage is disabled or throws
  memoryFallback: {
    defects: null,
    tasks: null,
    settings: null,
  },

  isStorageAvailable() {
    try {
      const testKey = '__hp_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Load defects from localStorage or initialize with sample data
   * @returns {Array} List of defect objects
   */
  getDefects() {
    if (!this.isStorageAvailable()) {
      if (!this.memoryFallback.defects) {
        this.memoryFallback.defects = SampleData.getInitialDefects();
      }
      return this.memoryFallback.defects;
    }

    try {
      const raw = window.localStorage.getItem(this.KEYS.DEFECTS);
      if (!raw) {
        const initial = SampleData.getInitialDefects();
        this.saveDefects(initial);
        return initial;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const initial = SampleData.getInitialDefects();
        this.saveDefects(initial);
        return initial;
      }
      return parsed;
    } catch (err) {
      console.warn('HighwayPulse: Failed to parse stored defects. Restoring defaults.', err);
      const initial = SampleData.getInitialDefects();
      this.saveDefects(initial);
      return initial;
    }
  },

  /**
   * Save defects to storage
   * @param {Array} defects 
   */
  saveDefects(defects) {
    if (!this.isStorageAvailable()) {
      this.memoryFallback.defects = defects;
      return true;
    }
    try {
      window.localStorage.setItem(this.KEYS.DEFECTS, JSON.stringify(defects));
      return true;
    } catch (err) {
      console.error('HighwayPulse: LocalStorage save failed.', err);
      this.memoryFallback.defects = defects;
      return false;
    }
  },

  /**
   * Add a new defect
   * @param {Object} defect 
   */
  addDefect(defect) {
    const list = this.getDefects();
    list.unshift(defect);
    this.saveDefects(list);
    return defect;
  },

  /**
   * Update an existing defect
   * @param {string} id 
   * @param {Object} updates 
   */
  updateDefect(id, updates) {
    const list = this.getDefects();
    const index = list.findIndex(d => d.id === id);
    if (index === -1) return null;

    const updated = { ...list[index], ...updates };
    // Recalculate priority if scores were modified
    if (
      updates.severity !== undefined ||
      updates.trafficExposure !== undefined ||
      updates.safetyRisk !== undefined ||
      updates.timeUnresolved !== undefined
    ) {
      const calc = PrioritySystem.calculate(
        updated.severity,
        updated.trafficExposure,
        updated.safetyRisk,
        updated.timeUnresolved
      );
      updated.priorityScore = calc.displayScore;
      updated.rawPriorityScore = calc.rawScore;
      updated.priority = calc.category;
      updated.priorityBreakdown = calc.breakdown;
    }

    list[index] = updated;
    this.saveDefects(list);
    return updated;
  },

  /**
   * Delete a defect by ID
   * @param {string} id 
   */
  deleteDefect(id) {
    const list = this.getDefects();
    const filtered = list.filter(d => d.id !== id);
    this.saveDefects(filtered);
    return filtered.length !== list.length;
  },

  /**
   * Load maintenance tasks
   * @returns {Array}
   */
  getTasks() {
    if (!this.isStorageAvailable()) {
      if (!this.memoryFallback.tasks) {
        this.memoryFallback.tasks = SampleData.getInitialTasks();
      }
      return this.memoryFallback.tasks;
    }

    try {
      const raw = window.localStorage.getItem(this.KEYS.TASKS);
      if (!raw) {
        const initial = SampleData.getInitialTasks();
        this.saveTasks(initial);
        return initial;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const initial = SampleData.getInitialTasks();
        this.saveTasks(initial);
        return initial;
      }
      return parsed;
    } catch (err) {
      console.warn('HighwayPulse: Failed to parse stored tasks. Restoring defaults.', err);
      const initial = SampleData.getInitialTasks();
      this.saveTasks(initial);
      return initial;
    }
  },

  /**
   * Save tasks
   * @param {Array} tasks 
   */
  saveTasks(tasks) {
    if (!this.isStorageAvailable()) {
      this.memoryFallback.tasks = tasks;
      return true;
    }
    try {
      window.localStorage.setItem(this.KEYS.TASKS, JSON.stringify(tasks));
      return true;
    } catch (err) {
      console.error('HighwayPulse: LocalStorage save tasks failed.', err);
      this.memoryFallback.tasks = tasks;
      return false;
    }
  },

  /**
   * Add a maintenance task
   * @param {Object} task 
   */
  addTask(task) {
    const tasks = this.getTasks();
    tasks.unshift(task);
    this.saveTasks(tasks);
    return task;
  },

  /**
   * Update a maintenance task
   * @param {string} id 
   * @param {Object} updates 
   */
  updateTask(id, updates) {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return null;
    tasks[index] = { ...tasks[index], ...updates };
    this.saveTasks(tasks);
    return tasks[index];
  },

  /**
   * Delete a maintenance task
   * @param {string} id 
   */
  deleteTask(id) {
    const tasks = this.getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    this.saveTasks(filtered);
    return filtered.length !== tasks.length;
  },

  /**
   * Get user settings
   */
  getSettings() {
    const defaults = {
      theme: 'light', // 'light' (default) or 'dark'
      pageSize: 10,
      defaultView: 'overview',
    };

    if (!this.isStorageAvailable()) {
      return this.memoryFallback.settings || defaults;
    }

    try {
      const raw = window.localStorage.getItem(this.KEYS.SETTINGS);
      if (!raw) return defaults;
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  },

  /**
   * Save settings
   * @param {Object} settings 
   */
  saveSettings(settings) {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    if (!this.isStorageAvailable()) {
      this.memoryFallback.settings = updated;
      return updated;
    }
    try {
      window.localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save settings to localStorage', e);
    }
    return updated;
  },

  /**
   * Reset all data back to original fictional demonstration dataset
   */
  resetToSampleData() {
    const defects = SampleData.getInitialDefects();
    const tasks = SampleData.getInitialTasks();
    this.saveDefects(defects);
    this.saveTasks(tasks);
    return { defects, tasks };
  }
};
