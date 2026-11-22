# Anchor Relay — design and architecture

For a student with ADHD who gets interrupted and can't find the way back into work.
**Anchor** shows one step at a time. **Relay** saves where you stopped and gives you a "Welcome back" card.
It's a static site with no build step and no framework, and it runs fully offline. Gemini is optional and uses the user's own key.

## Files
| File | Role | Status |
|---|---|---|
| `index.html` | Markup for all screens, icon sprite, help dialog. DOM ids are the contract | done |
| `styles.css` | Design tokens, 3 themes, comfort modes, components | done |
| `i18n.js` | `I18N.{t, apply, setLang, getLang, STRINGS}`: all UI strings, en + bn | done |
| `store.js` | `Store`: data model, safe localStorage with in-memory fallback, model helpers | done |
| `engine.js` | `AnchorEngine`: deterministic offline parser (UMD, runs in Node) | done + tested |
| `app.js` | Shell (router, settings, keys, i18n) plus controller **stubs** marked `TODO(impl)` | shell done |
| `tests/engine.test.js` | `node tests/engine.test.js` (11 tests, en + bn) | passing |

Script order: engine → i18n → store → app. Nothing is loaded from the network.

## Screens (`state.view`)
1. **capture**: brain-dump textarea, then a preview of tasks and steps, then "Start". Also "Load demo scenario".
2. **focus**: ONE card with the step text in a large serif, the task name, a progress ring, and Done / Not now / I'm stuck / Read aloud. Never shows a list.
3. **interrupt**: "Where did you stop?" textarea, with an optional mic and "Save and go".
4. **saved**: "Saved. Go." with an "I'm back" button.
5. **recovery**: "Welcome back". Shows time away, the reason, ONE next tiny step (highlighted), Done / Still to do, the last thought, and Start / Handoff / Read.
6. **handoff**: read-only summary text with Copy and Read.
7. **settings**: theme, larger text, dyslexia font, line spacing, reduce motion, speech rate, Gemini key, clear data.
- The persistent `#interrupt-fab` button is visible everywhere except interrupt and saved.
- `?` opens `<dialog id="help-dialog">`.
- Boot routing: an open interruption goes to recovery. Otherwise, no tasks goes to capture, else the last view.

## Data model (store.js, key `anchor-relay:v1`)
```
State  { version:1, lang:'en'|'bn', view, settings, tasks:Task[], currentTaskId, interruption, history[] }
Settings { theme:'calm'|'dark'|'contrast', largeText, dyslexia, spacing, reduceMotion:null|bool, rate, apiKey, model }
Task   { id, title, lang, createdAt, steps:Step[] }
Step   { id, text, base, depth, status:'todo'|'done' }   // base = original text, depth = times split
Interruption { id, at, raw, taskId, source:'offline'|'gemini', subject, done[], pending[], next,
               reason, lastThought, resolvedAt? }
```
Helpers: `Store.makeTask(title, steps[], lang)`, `makeStep(text, depth, base)`, `currentTask(s)`, `currentStep(s)`, `progress(task)`.

## Engine (engine.js): rules
- **Language**: `detectLang` returns bn if Bengali chars × 2 ≥ Latin chars. All output matches the input language.
- **Normalisation**: input and Bangla patterns are NFC-normalised, because য় has two encodings.
- **Clauses**: split on `. ! ? ।`, newlines, `;`, `but / then / কিন্তু / তবে / তারপর`. Then split on `, and এবং আর`. Fragments with no marker of their own are glued back, so "sections 1, 2 and 3" stays one clause.
- **Classify** (first match wins): thought → context ("I was working on X", "X করছিলাম") → pending-strong (left, still, not yet, বাকি, হয়নি) → interrupt (meeting, call, urgent, মিটিং, জরুরি, ডাকছে) → pending-weak (need to, করতে হবে) → done (finished, wrote, শেষ করেছি, করেছি).
- **Structured items**: "sections 1 and 2", "questions 1-3", "first two slides", "third section", "প্রথম দুটি সেকশন", "তৃতীয় সেকশন", "সেকশন ১ ও ২". These become `Section 1` / `সেকশন ১`. Free-text leftovers are kept too ("the intro" becomes "Intro").
- **Next tiny step**: chosen by item kind (write / read / email / slides / question / code / generic). Item kind falls back to subject kind. Always one concrete, two-minute-sized action.
- **Stuck split**: (1) split at a natural seam (and / then / এবং / ,). (2) Otherwise use tiered gentler steps by `depth`: get ready + first 2 min → find the one file + breathe → just look 30 s + one messy move. Uses `base` so quotes never nest.
- **Brain dump**: lines, bullets and numbered lists. A run-on line is split on sentences, commas and "then"/"তারপর". `Title: a, b, c` makes those the steps. Structured items become steps. Otherwise each task gets 3 kind-based starter steps.
- **Handoff**: plain text with these parts: title + time, Done, Still to do, Next tiny step, Last thought, Why I stopped.

## Design system
Direction: **quiet desk**. Warm paper, ink, one deep pine accent, ochre focus ring. Editorial serif for the one thing that matters (the step) and a calm sans for the UI. No red, no urgency, no confetti, no emoji. Icons are inline stroke SVG (`#i-*`).

| Token | calm | dark | contrast |
|---|---|---|---|
| `--bg` | #f3efe7 | #121719 | #000 |
| `--surface` | #fbf9f5 | #1a2124 | #000 |
| `--ink` | #1d2427 (13.7:1) | #ebe6dc (14.5:1) | #fff |
| `--muted` | #4a5559 (6.7:1) | #a8b1ae (8.2:1) | #fff |
| `--accent` / `--accent-ink` | #23524d / #fff (8.8:1) | #8cc3b5 / #0d1a18 (9.0:1) | #ffe14d / #000 |
| `--focus` | #8a4a0c (6.0:1) | #f0b866 (10.1:1) | #00e5ff |

- **Type**: `--font-display` is Iowan / Charter / Georgia, then Noto Serif Bengali. `--font-ui` is Inter / system-ui, then Noto Sans Bengali. `--font-dyslexia` is Atkinson Hyperlegible, then Lexend, then Verdana. All are local font stacks, nothing is downloaded. The scale uses `--fs-xs…--fs-step`, all multiplied by `--scale`.
- **Space**: 4 px base (`--s1…--s8`). Radius is 14 / 22 / pill. Reading measure is 38 rem. Touch targets are at least 44 px.
- **Modes** (classes on `<html>`): `.theme-*`, `.is-large-text` (scale 1.2), `.is-dyslexia` (font + letter/word spacing), `.is-spacing` (line-height 1.9), `.is-reduced-motion`. The OS `prefers-reduced-motion` setting is respected unless the user sets `reduceMotion:false` (`.motion-ok`).
- **Components**: `.card`, `.btn` (`-primary` / `-quiet` / `-lg` / `-sm`), `.interrupt-fab`, `.focus-card`, `.ring` (r = 52, C = 326.73), `.next-step`, `.list` (done / todo), `.thought`, `.toggle` (checkbox with `role=switch`), `.segmented` (radio), `dialog`, `.keymap`, `.toast`, `.kbd`, `.eyebrow`, `.sr-only`, `.skip-link`.
- **Motion**: a 6 px fade-rise on view change (600 ms) and the ring easing. Both drop to 0 ms when motion is reduced.

## Accessibility
- Skip link to `#main`.
- `:focus-visible` has a 3 px ochre outline (4 px in high contrast).
- On view change, focus moves to the step text or the h1.
- `#announcer` is `role=status`, `aria-live=polite`. `announce()` updates it and the visible toast together.
- Real buttons, labels, `fieldset`/`legend`, and `aria-current` on the nav. `aria-keyshortcuts` is set on action buttons. The ring is `aria-hidden` with text in `#focus-progress-text`.
- Read aloud uses `speechSynthesis` with a bn-BD or en voice. Voice input uses `SpeechRecognition` and is feature-detected; if it's missing, a hint is shown instead.

## Keyboard map
| Key | Action | Where |
|---|---|---|
| Enter | Done | focus, when focus is not on a control |
| S | I'm stuck (split) | focus |
| N | Not now | focus |
| R | Read aloud | focus / recovery / handoff |
| I | I'm interrupted | anywhere except interrupt and saved |
| ? | Help dialog | anywhere |
| Esc | Close dialog / stop speech / leave interrupt | anywhere |

Shortcuts pause while typing in a field and are ignored when Ctrl, Alt or Meta is held.

## Gemini (optional)
- Key is stored only in `state.settings.apiKey`.
- Calls `POST …/v1beta/models/{model}:generateContent` with the key in the `x-goog-api-key` header (never in the URL).
- Asks for strict JSON in the `parseStatus` shape, with an 8 s timeout. Any error or bad shape returns `E.parseStatus(raw)` silently.

## Demo (Rafi)
- Rafi is writing a 3-section climate adaptation report. Sections 1–2 are done and section 3 is to do. Two other tasks are an email to Professor Karim and revising flashcards.
- An interruption from 18 minutes ago uses the sample sentence (en or bn, following `state.lang`).
- The demo lands on the recovery card.
