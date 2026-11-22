/*
 * Anchor Relay — state + persistence.
 * One JSON blob in localStorage under KEY. Every storage call is wrapped in try/catch;
 * if storage is blocked (private mode, file:// quirks) we keep state in memory and set
 * Store.persistent = false so the UI can say so.
 *
 * DATA MODEL (version 1)
 * State {
 *   version: 1,
 *   lang: 'en' | 'bn',
 *   view: 'capture' | 'focus' | 'interrupt' | 'saved' | 'recovery' | 'handoff' | 'settings',
 *   settings: Settings,
 *   tasks: Task[],              // ordered queue; Focus only ever shows ONE step
 *   currentTaskId: string|null,
 *   interruption: Interruption|null,   // open (unresolved) interruption, drives "Welcome back"
 *   history: Interruption[]     // resolved interruptions, newest first, capped at 20
 * }
 * Settings {
 *   theme: 'calm' | 'dark' | 'contrast',
 *   largeText: bool, dyslexia: bool, spacing: bool,
 *   reduceMotion: bool | null,  // null = follow OS prefers-reduced-motion
 *   rate: number (0.6–1.4),     // speechSynthesis rate
 *   apiKey: string,             // optional Gemini key, never leaves the browser except to Google
 *   model: string               // Gemini model id
 * }
 * Task  { id, title, lang, createdAt, steps: Step[] }
 * Step  { id, text, base, depth, status: 'todo' | 'done' }
 *         base  = original step text (stuck-splits reference it so quotes never nest)
 *         depth = how many times it has been split (0 = original)
 * Interruption {
 *   id, at (ms), raw (user's words), taskId|null, source: 'offline' | 'gemini',
 *   subject, done: string[], pending: string[], next: string, reason, lastThought,
 *   resolvedAt?: number
 * }
 */
(function (root) {
  'use strict';

  const KEY = 'anchor-relay:v1';

  const defaults = () => ({
    version: 1,
    lang: 'en',
    view: 'capture',
    settings: { theme: 'dark', designV: 2, largeText: false, dyslexia: false, spacing: false, reduceMotion: null, rate: 0.95, apiKey: '', model: 'gemini-2.5-flash' },
    tasks: [],
    currentTaskId: null,
    interruption: null,
    history: [],
    stats: { days: {} },
  });

  let memory = null; // in-memory fallback
  let persistent = true;

  const uid = (p) => (p || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

  /** Load state, merging over defaults so new fields survive old saves. */
  function load() {
    let raw = null;
    try {
      raw = root.localStorage.getItem(KEY);
    } catch (e) {
      persistent = false;
    }
    if (!raw && memory) return memory;
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      const d = defaults();
      memory = parsed ? Object.assign(d, parsed, { settings: Object.assign(d.settings, parsed.settings || {}) }) : d;
    } catch (e) {
      memory = defaults(); // corrupt JSON -> start fresh, never crash
    }
    return memory;
  }

  /** Persist the whole state. Returns true if it reached localStorage. */
  function save(state) {
    memory = state;
    try {
      root.localStorage.setItem(KEY, JSON.stringify(state));
      persistent = true;
      return true;
    } catch (e) {
      persistent = false;
      return false;
    }
  }

  function reset() {
    memory = defaults();
    try {
      root.localStorage.removeItem(KEY);
    } catch (e) {}
    return memory;
  }

  /* ----- small pure helpers over the model (shared by controllers) ----- */

  /** @returns {Task} */
  function makeTask(title, stepTexts, lang) {
    return {
      id: uid('t'),
      title,
      lang: lang || 'en',
      createdAt: Date.now(),
      steps: stepTexts.map((text) => makeStep(text, 0, text)),
    };
  }
  /** @returns {Step} */
  function makeStep(text, depth, base) {
    return { id: uid('s'), text, base: base || text, depth: depth || 0, status: 'todo' };
  }
  const currentTask = (s) => s.tasks.find((t) => t.id === s.currentTaskId) || s.tasks.find((t) => t.steps.some((x) => x.status === 'todo')) || null;
  const currentStep = (s) => {
    const t = currentTask(s);
    return t ? t.steps.find((x) => x.status === 'todo') || null : null;
  };
  const progress = (task) => {
    const total = task ? task.steps.length : 0;
    const done = task ? task.steps.filter((x) => x.status === 'done').length : 0;
    return { done, total, ratio: total ? done / total : 0 };
  };

  root.Store = {
    KEY,
    defaults,
    load,
    save,
    reset,
    uid,
    makeTask,
    makeStep,
    currentTask,
    currentStep,
    progress,
    get persistent() {
      return persistent;
    },
  };
})(typeof self !== 'undefined' ? self : this);
