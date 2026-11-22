// Run: node tests/engine.test.js   (no dependencies)
'use strict';
const assert = require('node:assert/strict');
const E = require('../engine.js');

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (e) {
    console.error('  FAIL ' + name + '\n       ' + e.message);
    process.exitCode = 1;
  }
};

console.log('Anchor Relay engine');

test('detects language', () => {
  assert.equal(E.detectLang('I finished section 1'), 'en');
  assert.equal(E.detectLang('তৃতীয় সেকশন বাকি'), 'bn');
});

test('English status: done / pending / reason / urgent', () => {
  const r = E.parseStatus('I finished sections 1 and 2, section 3 left, urgent meeting now');
  assert.deepEqual(r.done, ['Section 1', 'Section 2']);
  assert.deepEqual(r.pending, ['Section 3']);
  assert.match(r.reason, /meeting/);
  assert.equal(r.urgent, true);
});

test('Bangla status: subject, ordinals, counts', () => {
  const r = E.parseStatus('আমি রিপোর্ট করছিলাম। প্রথম দুটি সেকশন শেষ করেছি। তৃতীয় সেকশন বাকি।');
  assert.equal(r.lang, 'bn');
  assert.equal(r.subject, 'রিপোর্ট');
  assert.deepEqual(r.done, ['সেকশন ১', 'সেকশন ২']);
  assert.deepEqual(r.pending, ['সেকশন ৩']);
});

test('mixed free text + structured items, last thought', () => {
  const r = E.parseStatus('I was working on the climate report. Finished the intro and section 2, I still need to write the conclusion. I was about to add the flood chart.');
  assert.equal(r.subject, 'climate report');
  assert.deepEqual(r.done, ['Intro', 'Section 2']);
  assert.deepEqual(r.pending, ['Write the conclusion']);
  assert.match(r.lastThought, /flood chart/);
});

test('ranges and "first two"', () => {
  assert.deepEqual(E.parseStatus('Done with questions 1-3. Question 4 left').done, ['Question 1', 'Question 2', 'Question 3']);
  assert.deepEqual(E.parseStatus('Finished the first two slides').done, ['Slide 1', 'Slide 2']);
});

test('Bangla interruption reason', () => {
  const r = E.parseStatus('ভূমিকা লিখেছি, উপসংহার এখনো বাকি, মা ডাকছে');
  assert.deepEqual(r.pending, ['উপসংহার']);
  assert.match(r.reason, /ডাকছে/);
});

test('next tiny step is concrete and language-matched', () => {
  assert.equal(E.nextTinyStep('Section 3', 'report', 'en'), 'Open the report and write one rough sentence for Section 3.');
  assert.match(E.nextTinyStep('সেকশন ৩', 'রিপোর্ট', 'bn'), /^রিপোর্ট খুলুন/);
  assert.match(E.nextTinyStep('', '', 'en'), /next small piece/);
});

test('stuck split: natural seam, then gentler tiers', () => {
  assert.deepEqual(E.splitStep('Outline and draft the intro', 'en'), ['Outline', 'Draft the intro']);
  const [a, b] = E.splitStep({ text: 'Write section 3', depth: 0 }, 'en');
  assert.match(a, /Get ready/);
  assert.match(b, /2 minutes/);
  const deep = E.splitStep({ text: 'x', base: 'Write section 3', depth: 1 }, 'en');
  assert.ok(!/“Get ready/.test(deep[0]), 'quotes must not nest');
  assert.equal(E.splitStep({ text: 'রিপোর্ট লিখুন', depth: 0 }, 'bn').length, 2);
});

test('brain dump splitting (lines, colon lists, run-on Bangla)', () => {
  const t = E.splitBrainDump('Climate report: section 1, section 2, section 3\n- Email Professor Karim\n2. Revise chemistry flashcards');
  assert.equal(t.length, 3);
  assert.equal(t[0].title, 'Climate report');
  assert.deepEqual(t[0].steps, ['Section 1', 'Section 2', 'Section 3']);
  assert.equal(t[1].title, 'Email Professor Karim');
  assert.equal(t[1].steps[0], 'Write the subject line');
  const b = E.splitBrainDump('রিপোর্ট লিখতে হবে, তারপর স্যারকে ইমেইল পাঠাতে হবে, রসায়ন নোট পড়তে হবে');
  assert.equal(b.length, 3);
  assert.equal(b[1].title, 'স্যারকে ইমেইল পাঠাতে হবে');
  const one = E.splitBrainDump('I need to finish the essay, then email Sara and also clean my desk');
  assert.deepEqual(one.map((x) => x.title), ['Finish the essay', 'Email Sara', 'Clean my desk']);
});

test('handoff summary has all sections in both languages', () => {
  const ctx = { subject: 'Report', done: ['Section 1'], pending: ['Section 3'], next: 'Write one sentence', reason: 'meeting', lastThought: 'add chart', at: 0 };
  const en = E.handoffSummary(ctx, 'en');
  ['Handoff — Report', 'Done:', '- Section 1', 'Still to do:', '- Section 3', 'Next tiny step: Write one sentence', 'Last thought: add chart', 'Why I stopped: meeting'].forEach((s) => assert.ok(en.includes(s), s));
  const bn = E.handoffSummary(ctx, 'bn');
  assert.ok(bn.includes('এখনো বাকি:'));
});

test('deterministic', () => {
  const s = 'I finished sections 1 and 2, section 3 left';
  assert.deepEqual(E.parseStatus(s), E.parseStatus(s));
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
