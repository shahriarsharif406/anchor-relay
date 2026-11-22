/*
 * Anchor Relay — app shell + controller contracts.
 *
 * WHAT IS IMPLEMENTED HERE (foundation):
 *   boot, view router, settings -> <html> classes, i18n application, language toggle,
 *   help dialog, announce()/toast(), global keyboard dispatch, persistence via Store.
 *
 * WHAT IS STUBBED (implementer fills in; every stub has its contract in the doc comment):
 *   Capture, Focus, Interrupt, Recovery, Handoff, Settings controllers, Speech (read aloud),
 *   Voice (speech recognition), AI (optional Gemini), Demo.
 *   Stubs are marked `TODO(impl)`. Signatures and DOM ids are the contract — keep them.
 *
 * Globals used: AnchorEngine (engine.js), I18N (i18n.js), Store (store.js).
 */
(function () {
  'use strict';

  const E = window.AnchorEngine;
  const { t } = window.I18N;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** Single mutable app state (see data model in store.js). */
  let state = Store.load();

  /** Persist after every mutation. Controllers call this; never touch localStorage directly. */
  function commit() {
    Store.save(state);
  }

  /* ======================================================================
     Shell utilities (implemented)
     ====================================================================== */

  /** Announce to screen readers (polite) and optionally show a visible toast. */
  function announce(message, { toast: showToast = true } = {}) {
    const el = $('#announcer');
    el.textContent = '';
    // Re-set on the next frame so repeated identical messages are still read.
    requestAnimationFrame(() => (el.textContent = message));
    if (showToast) toast(message);
  }

  let toastTimer = null;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3200);
  }

  const VIEWS = ['capture', 'focus', 'interrupt', 'saved', 'recovery', 'handoff', 'settings'];
  const RENDER = {}; // view -> render function, filled by controllers below

  /**
   * Show one view, hide the rest, update nav, render it, move focus to its heading.
   * @param {string} view one of VIEWS
   * @param {{focus?: boolean}} [opts] focus=false keeps keyboard focus where it is
   */
  function go(view, opts) {
    if (!VIEWS.includes(view)) view = 'focus';
    state.view = view;
    commit();
    $$('[data-view-panel]').forEach((p) => (p.hidden = p.dataset.viewPanel !== view));
    $$('.nav [data-view]').forEach((b) => (b.dataset.view === view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    $('#interrupt-fab').hidden = view === 'interrupt' || view === 'saved';
    if (RENDER[view]) RENDER[view]();
    if (!opts || opts.focus !== false) {
      const panel = $(`[data-view-panel="${view}"]`);
      const target = $('[tabindex="-1"].step-text:not(:empty)', panel) || $('h1', panel);
      if (target) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: false });
      }
    }
  }

  /** Reflect settings onto <html> classes. Called on boot and after any settings change. */
  function applySettings() {
    const s = state.settings;
    const html = document.documentElement;
    ['theme-calm', 'theme-dark', 'theme-contrast'].forEach((c) => html.classList.remove(c));
    html.classList.add('theme-' + (s.theme || 'calm'));
    html.classList.toggle('is-large-text', !!s.largeText);
    html.classList.toggle('is-dyslexia', !!s.dyslexia);
    html.classList.toggle('is-spacing', !!s.spacing);
    // reduceMotion: null follows the OS; true forces off; false explicitly allows motion.
    html.classList.toggle('is-reduced-motion', s.reduceMotion === true);
    html.classList.toggle('motion-ok', s.reduceMotion === false);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(html).getPropertyValue('--bg').trim() || '#f3efe7';
  }

  /** Apply the current language to <html lang>, static strings, and the visible view. */
  function applyLang() {
    I18N.setLang(state.lang);
    I18N.apply(document);
    document.title = t('app.name') + ' — ' + t('app.tagline');
    if (RENDER[state.view]) RENDER[state.view]();
  }

  /** Human "time away" string, e.g. "18 min". */
  function formatAway(ms) {
    const mins = Math.max(0, Math.round(ms / 60000));
    if (mins < 1) return t('time.justnow');
    if (mins < 60) return t('time.minutes', { n: mins });
    return t('time.hours', { n: Math.floor(mins / 60), m: mins % 60 });
  }

  /** True when the key event comes from a text field (shortcuts must pause). */
  const isTyping = (e) => {
    const el = e.target;
    return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  };

  /* ======================================================================
     Controllers
     ====================================================================== */

  const norm = (s) => String(s || '').trim().toLowerCase();
  const dedupe = (arr) => {
    const seen = new Set();
    return arr.filter((x) => {
      const k = norm(x);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const hasTodo = (task) => task.steps.some((s) => s.status === 'todo');

  /** Make sure currentTaskId points at a task that still has something to do (or null). */
  function ensureCurrent() {
    const cur = state.tasks.find((x) => x.id === state.currentTaskId);
    if (cur && hasTodo(cur)) return;
    const next = state.tasks.find(hasTodo);
    state.currentTaskId = next ? next.id : null;
  }

  /** <li> with an inline icon and text — text is always set via textContent (no HTML injection). */
  function iconItem(iconId, text) {
    const li = document.createElement('li');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + iconId);
    svg.appendChild(use);
    const span = document.createElement('span');
    span.textContent = text;
    li.append(svg, span);
    return li;
  }
  const fillList = (el, items, iconId) => {
    el.replaceChildren();
    const list = items && items.length ? items : [t('recovery.none')];
    list.forEach((x) => el.appendChild(iconItem(items && items.length ? iconId : 'i-dot', x)));
  };

  let previewTasks = []; // parsed brain dump waiting for "Start"

  const Capture = {
    render() {
      const box = $('#capture-preview');
      box.hidden = !previewTasks.length;
      const list = $('#capture-preview-list');
      list.replaceChildren();
      previewTasks.forEach((task) => {
        const block = document.createElement('div');
        block.className = 'preview-task';
        const h = document.createElement('h3');
        h.textContent = task.title;
        const ol = document.createElement('ol');
        task.steps.forEach((s) => {
          const li = document.createElement('li');
          li.textContent = s;
          ol.appendChild(li);
        });
        block.append(h, ol);
        list.appendChild(block);
      });
    },

    submit() {
      const text = $('#capture-input').value.trim();
      if (!text) {
        announce(t('capture.empty'));
        $('#capture-input').focus();
        return;
      }
      previewTasks = E.splitBrainDump(text, E.detectLang(text)).filter((x) => x.title);
      if (!previewTasks.length) {
        announce(t('capture.empty'));
        return;
      }
      Capture.render();
      const target = $('#preview-title');
      target.setAttribute('tabindex', '-1');
      target.focus();
    },

    start() {
      if (!previewTasks.length) return;
      const lang = E.detectLang($('#capture-input').value) || state.lang;
      const made = previewTasks.map((x) => Store.makeTask(x.title, x.steps, lang));
      state.tasks.push(...made);
      state.currentTaskId = made[0].id;
      previewTasks = [];
      $('#capture-input').value = '';
      commit();
      go('focus');
    },
  };

  const Focus = {
    render() {
      ensureCurrent();
      const step = Store.currentStep(state);
      const task = Store.currentTask(state);
      $('#focus-card').hidden = !step;
      $('#focus-empty').hidden = !!step;
      if (!step) return;
      const p = Store.progress(task);
      $('#focus-step').textContent = step.text;
      $('#focus-task').textContent = t('focus.task', { task: task.title });
      $('#focus-ring-fill').style.strokeDashoffset = String(326.73 * (1 - p.ratio));
      $('#focus-ring-count').textContent = p.done + '/' + p.total;
      $('#focus-progress-text').textContent = t('focus.progress', { done: p.done, total: p.total });
    },

    done() {
      const step = Store.currentStep(state);
      const task = Store.currentTask(state);
      if (!step) return;
      Speech.stop();
      step.status = 'done';
      if (!hasTodo(task)) {
        ensureCurrent();
        announce(t('focus.taskdone'));
      }
      commit();
      go('focus');
    },

    notNow() {
      const step = Store.currentStep(state);
      const task = Store.currentTask(state);
      if (!step) return;
      Speech.stop();
      const todos = task.steps.filter((x) => x.status === 'todo');
      if (todos.length > 1) {
        task.steps.splice(task.steps.indexOf(step), 1);
        task.steps.push(step);
      } else {
        // Only one thing left here: rotate to the next task that still has work, if any.
        const idx = state.tasks.indexOf(task);
        const others = state.tasks.slice(idx + 1).concat(state.tasks.slice(0, idx)).filter(hasTodo);
        if (others.length) state.currentTaskId = others[0].id;
      }
      announce(t('focus.later'));
      commit();
      go('focus');
    },

    stuck() {
      const step = Store.currentStep(state);
      const task = Store.currentTask(state);
      if (!step) return;
      Speech.stop();
      const parts = E.splitStep({ text: step.text, base: step.base, depth: step.depth }, task.lang || state.lang);
      const made = parts.map((txt) => Store.makeStep(txt, step.depth + 1, step.base));
      task.steps.splice(task.steps.indexOf(step), 1, ...made);
      announce(t('focus.split'));
      commit();
      go('focus');
    },

    read() {
      const step = Store.currentStep(state);
      if (!step) return;
      const task = Store.currentTask(state);
      Speech.speak(step.text + '. ' + t('focus.task', { task: task.title }), task.lang);
    },
  };

  const Interrupt = {
    open() {
      go('interrupt');
      $('#interrupt-input').focus();
    },

    render() {
      const ok = Voice.supported();
      $('#voice-btn').hidden = !ok;
      $('#voice-unsupported').hidden = ok;
    },

    async save() {
      const btn = $('#interrupt-save');
      const input = $('#interrupt-input');
      const raw = input.value.trim();
      btn.disabled = true;
      try {
        Voice.stop();
        const parsed = await AI.parseStatus(raw);
        const task = Store.currentTask(state);
        const lang = raw ? parsed.lang || state.lang : state.lang;
        const doneSteps = task ? task.steps.filter((x) => x.status === 'done').map((x) => x.text) : [];
        const todoSteps = task ? task.steps.filter((x) => x.status === 'todo').map((x) => x.text) : [];
        const done = dedupe(doneSteps.concat(parsed.done || []));
        const doneKeys = new Set(done.map(norm));
        // A parsed "pending" item wins the first slot; task steps follow. Skip anything already done.
        const pending = dedupe((parsed.pending || []).concat(todoSteps)).filter((x) => !doneKeys.has(norm(x)));
        const subject = parsed.subject || (task ? task.title : '');
        const next = E.nextTinyStep(pending[0], subject, lang);
        if (state.interruption) {
          state.interruption.resolvedAt = Date.now();
          state.history.unshift(state.interruption);
        }
        state.interruption = {
          id: Store.uid('i'),
          at: Date.now(),
          raw,
          taskId: task ? task.id : null,
          source: parsed.source || 'offline',
          lang,
          subject,
          done,
          pending,
          next,
          reason: parsed.reason || '',
          lastThought: parsed.lastThought || '',
        };
        state.history = state.history.slice(0, 20);
        input.value = '';
        commit();
        go('saved');
      } finally {
        btn.disabled = false;
      }
    },
  };

  const Recovery = {
    render() {
      const it = state.interruption;
      if (!it) {
        go('focus');
        return;
      }
      $('#recovery-away').textContent = t('recovery.away', { time: formatAway(Date.now() - it.at) });
      $('#recovery-reason').textContent = it.reason ? t('recovery.reason', { reason: it.reason }) : '';
      $('#recovery-reason').hidden = !it.reason;
      $('#recovery-next').textContent = it.next;
      fillList($('#recovery-done'), it.done, 'i-check');
      fillList($('#recovery-todo'), it.pending, 'i-dot');
      $('#recovery-thought').textContent = it.lastThought || '';
      $('#recovery-thought-wrap').hidden = !it.lastThought;
    },

    start() {
      const it = state.interruption;
      if (!it) return;
      Speech.stop();
      let task = state.tasks.find((x) => x.id === it.taskId);
      if (!task) {
        task = Store.makeTask(it.subject || it.next, [], it.lang || state.lang);
        state.tasks.unshift(task);
      }
      const first = task.steps.findIndex((x) => x.status === 'todo');
      const step = Store.makeStep(it.next, 0, it.next);
      if (first === -1) task.steps.push(step);
      else task.steps.splice(first, 0, step);
      state.currentTaskId = task.id;
      it.resolvedAt = Date.now();
      state.history.unshift(it);
      state.history = state.history.slice(0, 20);
      state.interruption = null;
      commit();
      go('focus');
    },

    read() {
      const it = state.interruption;
      if (!it) return;
      const parts = [t('recovery.title') + '.', t('recovery.next') + ': ' + it.next + '.'];
      if (it.pending.length) parts.push(t('recovery.todo') + ': ' + it.pending.join('. ') + '.');
      Speech.speak(parts.join(' '), it.lang);
    },
  };

  const Handoff = {
    render() {
      let ctx = null;
      let lang = state.lang;
      const it = state.interruption || state.history[0];
      if (it) {
        ctx = { subject: it.subject, done: it.done, pending: it.pending, next: it.next, reason: it.reason, lastThought: it.lastThought, at: it.at };
        lang = it.lang || lang;
      } else {
        const task = Store.currentTask(state);
        if (task) {
          const todo = task.steps.filter((x) => x.status === 'todo').map((x) => x.text);
          ctx = {
            subject: task.title,
            done: task.steps.filter((x) => x.status === 'done').map((x) => x.text),
            pending: todo,
            next: todo[0] || '',
            at: Date.now(),
          };
          lang = task.lang || lang;
        }
      }
      $('#handoff-empty').hidden = !!ctx;
      $('#handoff-field').hidden = !ctx;
      if (ctx) $('#handoff-text').value = E.handoffSummary(ctx, lang);
    },

    async copy() {
      const ta = $('#handoff-text');
      try {
        await navigator.clipboard.writeText(ta.value);
        announce(t('handoff.copied'));
      } catch (e) {
        try {
          ta.select();
          if (!document.execCommand('copy')) throw new Error('copy failed');
          announce(t('handoff.copied'));
        } catch (e2) {
          announce(t('handoff.copyfail'));
        }
      }
    },
  };

  const Settings = {
    render() {
      const s = state.settings;
      $$('input[name="theme"]', $('#theme-group')).forEach((r) => (r.checked = r.value === s.theme));
      $$('[data-setting]').forEach((sw) => {
        const k = sw.dataset.setting;
        sw.checked = k === 'reduceMotion' ? s.reduceMotion === true || (s.reduceMotion === null && matchMedia('(prefers-reduced-motion: reduce)').matches) : !!s[k];
      });
      $('#rate-input').value = s.rate;
      const key = $('#api-key-input');
      key.value = '';
      key.placeholder = AI.enabled() ? '••••••••••••' : '';
    },

    bind() {
      const update = (fn) => {
        fn(state.settings);
        commit();
        applySettings();
      };
      $('#theme-group').addEventListener('change', (e) => {
        if (e.target.name === 'theme') update((s) => (s.theme = e.target.value));
      });
      $$('[data-setting]').forEach((sw) =>
        sw.addEventListener('change', () => {
          const k = sw.dataset.setting;
          if (k === 'reduceMotion') {
            const osReduces = matchMedia('(prefers-reduced-motion: reduce)').matches;
            update((s) => (s.reduceMotion = sw.checked ? true : osReduces ? false : null));
          } else update((s) => (s[k] = sw.checked));
        })
      );
      $('#rate-input').addEventListener('change', (e) => update((s) => (s.rate = Math.min(1.4, Math.max(0.6, parseFloat(e.target.value) || 0.95)))));
      $('#api-key-save').addEventListener('click', () => {
        const v = $('#api-key-input').value.trim();
        if (!v) return;
        update((s) => (s.apiKey = v));
        Settings.render();
        announce(t('settings.ai.saved'));
      });
      $('#api-key-clear').addEventListener('click', () => {
        update((s) => (s.apiKey = ''));
        Settings.render();
        announce(t('settings.ai.cleared'));
      });
      $('#reset-all').addEventListener('click', () => {
        if (!window.confirm(t('settings.reset.confirm'))) return;
        Speech.stop();
        previewTasks = [];
        state = Store.reset();
        applySettings();
        applyLang();
        go('capture');
        announce(t('settings.reset.done'));
      });
    },
  };

  const Speech = {
    supported: () => 'speechSynthesis' in window,

    speak(text, lang) {
      if (!Speech.supported() || !text) return;
      // Pressing read again while speaking acts as stop.
      if (speechSynthesis.speaking || speechSynthesis.pending) {
        speechSynthesis.cancel();
        return;
      }
      const L = lang || E.detectLang(text);
      const tag = L === 'bn' ? 'bn-BD' : 'en-US';
      const u = new SpeechSynthesisUtterance(text);
      u.lang = tag;
      u.rate = state.settings.rate || 0.95;
      const voices = speechSynthesis.getVoices();
      const v = voices.find((x) => x.lang === tag) || voices.find((x) => x.lang.toLowerCase().startsWith(L));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    },

    stop() {
      if (Speech.supported()) speechSynthesis.cancel();
    },
  };

  let recognizer = null;
  const Voice = {
    supported: () => !!(window.SpeechRecognition || window.webkitSpeechRecognition),

    stop() {
      if (recognizer) {
        try { recognizer.stop(); } catch (e) {}
      }
    },

    toggle(target) {
      const btn = $('#voice-btn');
      const label = $('#voice-btn-label');
      const reset = () => {
        recognizer = null;
        btn.setAttribute('aria-pressed', 'false');
        label.textContent = t('interrupt.voice');
      };
      if (recognizer) {
        Voice.stop();
        return;
      }
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return;
      const r = new SR();
      r.lang = state.lang === 'bn' ? 'bn-BD' : 'en-US';
      r.continuous = true;
      r.interimResults = false;
      r.onresult = (ev) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) {
            const chunk = ev.results[i][0].transcript.trim();
            if (chunk) target.value = (target.value ? target.value.replace(/\s*$/, ' ') : '') + chunk;
          }
        }
      };
      r.onend = reset;
      r.onerror = reset;
      try {
        r.start();
        recognizer = r;
        btn.setAttribute('aria-pressed', 'true');
        label.textContent = t('interrupt.voice.stop');
      } catch (e) {
        reset();
      }
    },
  };

  const AI = {
    enabled: () => !!(state.settings.apiKey || '').trim(),

    async parseStatus(raw) {
      const offline = () => Object.assign(E.parseStatus(raw), { source: 'offline' });
      if (!raw.trim() || !AI.enabled()) return offline();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const model = encodeURIComponent((state.settings.model || 'gemini-2.5-flash').trim());
        const prompt =
          'You help a person with ADHD return to interrupted work. Read their status note (English or Bangla) and answer with ONLY JSON: ' +
          '{"subject": string, "done": string[], "pending": string[], "reason": string, "lastThought": string}. ' +
          'Keep each item short, in the same language as the note. Do not invent items that are not in the note. Note:\n' +
          raw;
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': state.settings.apiKey.trim() },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error('http ' + res.status);
        const data = await res.json();
        const j = JSON.parse(data.candidates[0].content.parts[0].text);
        const strs = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : null);
        const done = strs(j.done);
        const pending = strs(j.pending);
        if (!done || !pending || (!done.length && !pending.length)) throw new Error('bad shape');
        const base = E.parseStatus(raw);
        return {
          lang: base.lang,
          subject: typeof j.subject === 'string' ? j.subject.trim() : base.subject,
          done,
          pending,
          reason: typeof j.reason === 'string' ? j.reason.trim() : '',
          lastThought: typeof j.lastThought === 'string' ? j.lastThought.trim() : '',
          urgent: base.urgent,
          source: 'gemini',
        };
      } catch (e) {
        return offline();
      } finally {
        clearTimeout(timer);
      }
    },
  };

  const Demo = {
    load() {
      const bn = state.lang === 'bn';
      const lang = bn ? 'bn' : 'en';
      const report = Store.makeTask(
        bn ? 'জলবায়ু অভিযোজন প্রতিবেদন' : 'Climate adaptation report',
        bn ? ['সেকশন ১', 'সেকশন ২', 'সেকশন ৩', 'উপসংহার লেখা', 'তথ্যসূত্র যোগ করা'] : ['Section 1', 'Section 2', 'Section 3', 'Write the conclusion', 'Add references'],
        lang
      );
      report.steps[0].status = 'done';
      report.steps[1].status = 'done';
      const email = Store.makeTask(
        bn ? 'প্রফেসর করিমকে ডেডলাইন নিয়ে ইমেইল' : 'Email Professor Karim about the deadline',
        bn ? ['বিষয় লাইন লিখুন', 'দুই-তিনটি ছোট বাক্য লিখুন', 'একবার পড়ে পাঠিয়ে দিন'] : ['Write the subject line', 'Write two or three short sentences', 'Read it once, then send'],
        lang
      );
      const cards = Store.makeTask(
        bn ? 'রসায়নের ফ্ল্যাশকার্ড রিভিশন' : 'Revise chemistry flashcards',
        bn ? ['প্রথম ১০টি কার্ড দেখুন', 'ভুল কার্ডগুলো আলাদা রাখুন'] : ['Go through the first 10 cards', 'Set the missed ones aside'],
        lang
      );
      const raw = bn
        ? 'আমি রিপোর্ট করছিলাম। প্রথম দুটি সেকশন শেষ করেছি। তৃতীয় সেকশন বাকি। এখন জরুরি মিটিংয়ে যেতে হবে।'
        : 'I was writing the climate adaptation report. I finished sections 1 and 2, section 3 left, urgent meeting now.';
      const p = E.parseStatus(raw, lang);
      const todo = report.steps.filter((x) => x.status === 'todo').map((x) => x.text);
      const pending = dedupe((p.pending || []).concat(todo));
      const subject = report.title;
      Speech.stop();
      previewTasks = [];
      state.tasks = [report, email, cards];
      state.currentTaskId = report.id;
      state.history = [];
      state.interruption = {
        id: Store.uid('i'),
        at: Date.now() - 18 * 60000,
        raw,
        taskId: report.id,
        source: 'offline',
        lang,
        subject,
        done: dedupe(report.steps.filter((x) => x.status === 'done').map((x) => x.text).concat(p.done || [])),
        pending,
        next: E.nextTinyStep(pending[0], subject, lang),
        reason: p.reason || '',
        lastThought: p.lastThought || '',
      };
      commit();
      go('recovery');
    },
  };

  RENDER.capture = () => Capture.render();
  RENDER.focus = () => Focus.render();
  RENDER.interrupt = () => Interrupt.render();
  RENDER.recovery = () => Recovery.render();
  RENDER.handoff = () => Handoff.render();
  RENDER.settings = () => Settings.render();

  /* ======================================================================
     Wiring (implemented)
     ====================================================================== */

  function bindEvents() {
    $$('[data-view]').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
    $('#brand-link').addEventListener('click', (e) => {
      e.preventDefault();
      go('focus');
    });

    $('#lang-toggle').addEventListener('click', () => {
      state.lang = state.lang === 'bn' ? 'en' : 'bn';
      commit();
      applyLang();
      announce(t('lang.toggle') === 'English' ? 'বাংলা' : 'English', { toast: false });
    });

    const help = $('#help-dialog');
    $('#help-open').addEventListener('click', () => help.showModal());

    // Capture
    $('#capture-submit').addEventListener('click', () => Capture.submit());
    $('#capture-start').addEventListener('click', () => Capture.start());
    $('#demo-load').addEventListener('click', () => Demo.load());

    // Focus
    $('#btn-done').addEventListener('click', () => Focus.done());
    $('#btn-notnow').addEventListener('click', () => Focus.notNow());
    $('#btn-stuck').addEventListener('click', () => Focus.stuck());
    $('#btn-read').addEventListener('click', () => Focus.read());

    // Interrupt / saved
    $('#interrupt-fab').addEventListener('click', () => Interrupt.open());
    $('#interrupt-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Interrupt.save();
    });
    $('#interrupt-cancel').addEventListener('click', () => go('focus'));
    $('#voice-btn').addEventListener('click', () => Voice.toggle($('#interrupt-input')));
    $('#back-btn').addEventListener('click', () => go('recovery'));

    // Recovery / handoff
    $('#recovery-start').addEventListener('click', () => Recovery.start());
    $('#recovery-handoff').addEventListener('click', () => go('handoff'));
    $('#recovery-read').addEventListener('click', () => Recovery.read());
    $('#handoff-copy').addEventListener('click', () => Handoff.copy());
    $('#handoff-read').addEventListener('click', () => Speech.speak($('#handoff-text').value));

    Settings.bind();

    // Global shortcuts. Paused while typing (except Esc). Ignore with modifier keys.
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (help.open) return; // <dialog> closes itself
        Speech.stop();
        if (state.view === 'interrupt') go('focus');
        return;
      }
      if (isTyping(e) || help.open) return;
      const v = state.view;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (k === '?') { e.preventDefault(); help.showModal(); return; }
      if (k === 'i' && v !== 'interrupt' && v !== 'saved') { e.preventDefault(); Interrupt.open(); return; }
      if (k === 'r') {
        e.preventDefault();
        if (v === 'focus') Focus.read();
        else if (v === 'recovery') Recovery.read();
        else if (v === 'handoff') Speech.speak($('#handoff-text').value);
        return;
      }
      if (v === 'focus') {
        // Enter on a focused button activates that button natively; only act when focus is elsewhere.
        const onControl = e.target.closest && e.target.closest('button, a, input, summary');
        if (k === 'Enter' && !onControl) { e.preventDefault(); Focus.done(); }
        else if (k === 's') { e.preventDefault(); Focus.stuck(); }
        else if (k === 'n') { e.preventDefault(); Focus.notNow(); }
      }
    });
  }

  function boot() {
    applySettings();
    I18N.setLang(state.lang);
    I18N.apply(document);
    document.title = t('app.name') + ' — ' + t('app.tagline');
    bindEvents();
    $('#storage-warning').hidden = Store.persistent;

    // Routing rule: an open interruption always lands on "Welcome back".
    let start = state.view;
    if (state.interruption && !state.interruption.resolvedAt) start = 'recovery';
    else if (start === 'interrupt' || start === 'saved' || start === 'recovery') start = 'focus';
    if (start === 'focus' && !state.tasks.length) start = 'capture';
    go(start, { focus: false });
  }

  // Expose for debugging/tests in the console (not a public API).
  window.AnchorApp = { get state() { return state; }, go, commit, announce, applySettings, applyLang, formatAway, Capture, Focus, Interrupt, Recovery, Handoff, Settings, Speech, Voice, AI, Demo };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
