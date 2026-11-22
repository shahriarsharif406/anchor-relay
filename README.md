# Anchor Relay

**One calm step at a time — and a way back after every interruption.**
Built for the [Taskforge](https://taskforge.devpost.com/) student hackathon.

**Live demo:** https://shahriarsharif406.github.io/anchor-relay/ · **Code:** this repo

## The problem
Rafi is a student with ADHD. A long to-do list freezes him, and when something interrupts his work (a call, a meeting) he can't find his way back. The tools he tries show everything at once and forget where he stopped.

## What Anchor Relay does
- **Anchor — one step only.** Paste a messy list, and the app shows a single small step with a soft progress ring. *Done*, *Not now*, or *I'm stuck* (splits the step into two smaller ones). No red badges, no confetti.
- **Relay — pick up where you left off.** Tap *I'm interrupted*, write or say where you stopped. When you return you get a *Welcome back* card: what's done, what's left, and **one** next tiny step. One click makes a handoff note a teammate can read.

## Accessibility
Keyboard-only use (Enter / S / N / R / I / ?), screen-reader announcements, read aloud, voice input, English + বাংলা, three themes (calm, dark, high contrast), large text, dyslexia-friendly font, extra spacing, reduced motion.

## Try it in 10 seconds
Open the app → **Load demo scenario** → you land on *Welcome back* for Rafi's report.

## Run it
Static site, no build step. Open `index.html`, or serve the folder (`python3 -m http.server`). Tests: `node tests/engine.test.js`.

## How it works
- Works **fully offline**: a rule-based engine (`engine.js`) splits tasks and reads status notes in English and Bangla.
- **Optional AI:** paste your own Gemini key in Settings for smarter parsing. It is stored only in your browser and sent only to Google; on any failure the app silently uses the offline engine.
- Data stays in your browser (`localStorage`). Nothing is uploaded.

Files: `index.html` (screens) · `styles.css` (design system) · `app.js` (controllers) · `engine.js` · `store.js` · `i18n.js` · `DESIGN.md`.

## Limitations
- The offline engine is keyword-based; unusual phrasings fall back to plain free-text items.
- Bangla voice input/read-aloud depend on the browser and installed voices.
- Not a medical tool and not tested with a clinical user group; the persona is illustrative.

## AI assistance and pre-existing work
Created during the hackathon period as new work. The code and design were written with AI assistance (Claude by Anthropic) under the author's direction. No pre-existing project code was reused.
