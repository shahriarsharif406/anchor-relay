/*
 * Anchor Relay — all UI strings live here (English + বাংলা).
 * Markup uses:  data-i18n="key"                      -> textContent
 *               data-i18n-attr="aria-label:key;placeholder:key2" -> attributes
 * Code uses:    I18N.t('key', { n: 3 })              -> "{n}" placeholders are filled in.
 * Missing bn keys fall back to en, missing en keys fall back to the key itself.
 * Engine-generated text (steps, summaries) is localised inside engine.js, not here.
 */
(function (root) {
  'use strict';

  const STRINGS = {
    en: {
      'app.name': 'Anchor Relay',
      'app.tagline': 'One thing at a time. Easy to come back to.',
      'skip': 'Skip to main content',
      'lang.toggle': 'বাংলা',
      'lang.toggle.label': 'Switch language to Bangla',

      'nav.label': 'Main',
      'nav.focus': 'Focus',
      'nav.capture': 'Capture',
      'nav.handoff': 'Handoff',
      'nav.settings': 'Settings',
      'nav.help': 'Keyboard help',

      'interrupt.button': "I'm interrupted",

      /* Capture */
      'capture.title': 'Empty your head',
      'capture.lead': 'Write everything on your mind. One line per thing is fine, messy is fine. We will turn it into small steps.',
      'capture.label': 'Brain dump',
      'capture.placeholder': 'Climate report: section 1, section 2, section 3\nEmail Professor Karim\nRevise chemistry flashcards',
      'capture.submit': 'Make steps',
      'capture.demo': 'Load demo scenario',
      'capture.demo.hint': 'See Rafi, a student coming back to a half-written report.',
      'capture.preview': 'Here is what we found',
      'capture.start': 'Start with the first one',
      'capture.empty': 'Write at least one thing first.',

      /* Focus */
      'focus.title': 'Now',
      'focus.eyebrow': 'Your one step',
      'focus.task': 'Part of: {task}',
      'focus.progress': '{done} of {total} steps done',
      'focus.done': 'Done',
      'focus.notnow': 'Not now',
      'focus.stuck': "I'm stuck",
      'focus.read': 'Read aloud',
      'focus.empty.title': 'Nothing waiting',
      'focus.empty.body': 'Your list is clear. Capture something new whenever you are ready.',
      'focus.taskdone': 'That task is finished. Take a breath.',
      'focus.split': 'Made it smaller: two easier steps.',
      'focus.later': 'Moved to later. No problem.',

      /* Interrupt */
      'interrupt.title': 'Save your place',
      'interrupt.lead': 'Say where you stopped, in your own words. You can go right after this.',
      'interrupt.label': 'Where did you stop?',
      'interrupt.placeholder': 'I finished sections 1 and 2, section 3 left, urgent meeting now',
      'interrupt.voice': 'Speak instead',
      'interrupt.voice.stop': 'Stop listening',
      'interrupt.voice.unsupported': 'Voice input is not available in this browser. Typing works the same.',
      'interrupt.save': 'Save and go',
      'interrupt.cancel': 'Back to my step',
      'interrupt.saved.title': 'Saved. Go.',
      'interrupt.saved.body': 'Everything is held here. When you return, you will see exactly where you were.',
      'interrupt.back': "I'm back",

      /* Recovery */
      'recovery.title': 'Welcome back',
      'recovery.away': 'You were away for {time}.',
      'recovery.reason': 'You stopped because: {reason}',
      'recovery.done': 'Done',
      'recovery.todo': 'Still to do',
      'recovery.next': 'One next tiny step',
      'recovery.thought': 'Your last thought',
      'recovery.start': 'Start this step',
      'recovery.handoff': 'Make handoff note',
      'recovery.none': 'Nothing yet',

      /* Handoff */
      'handoff.title': 'Handoff summary',
      'handoff.lead': 'A short note a teammate (or future you) can read in ten seconds.',
      'handoff.label': 'Summary text',
      'handoff.copy': 'Copy',
      'handoff.copied': 'Copied to clipboard.',
      'handoff.copyfail': 'Could not copy. Select the text and copy it manually.',
      'handoff.empty': 'Save an interruption first, and the summary will appear here.',

      /* Settings */
      'settings.title': 'Settings',
      'settings.display': 'Comfort and display',
      'settings.theme': 'Theme',
      'settings.theme.calm': 'Calm light',
      'settings.theme.dark': 'Calm dark',
      'settings.theme.contrast': 'High contrast',
      'settings.largeText': 'Larger text',
      'settings.dyslexia': 'Dyslexia-friendly font',
      'settings.spacing': 'Extra line spacing',
      'settings.reduceMotion': 'Reduce motion',
      'settings.voice': 'Read aloud',
      'settings.rate': 'Speaking speed',
      'settings.ai': 'Optional AI helper',
      'settings.ai.lead': 'Paste your own Gemini API key to get smarter parsing. It is stored only in this browser. Without it, everything still works offline.',
      'settings.ai.key': 'Gemini API key',
      'settings.ai.save': 'Save key',
      'settings.ai.clear': 'Remove key',
      'settings.ai.saved': 'Key saved in this browser.',
      'settings.ai.cleared': 'Key removed.',
      'settings.data': 'Your data',
      'settings.reset': 'Clear everything',
      'settings.reset.confirm': 'This removes all tasks and notes from this browser. Continue?',
      'settings.reset.done': 'All data cleared.',
      'settings.storage.memory': 'Storage is blocked in this browser, so data lasts only until you close the tab.',

      /* Help */
      'help.title': 'Keyboard shortcuts',
      'help.close': 'Close',
      'help.k.enter': 'Mark the current step done',
      'help.k.s': "I'm stuck: split the step",
      'help.k.n': 'Not now: move the step to later',
      'help.k.r': 'Read the current card aloud',
      'help.k.i': "I'm interrupted: save my place",
      'help.k.help': 'Show this help',
      'help.k.esc': 'Close a dialog or go back',
      'help.note': 'Shortcuts pause while you are typing in a text box.',

      /* Time */
      'time.minutes': '{n} min',
      'time.hours': '{n} h {m} min',
      'time.justnow': 'a moment',
    },

    bn: {
      'app.name': 'অ্যাঙ্কর রিলে',
      'app.tagline': 'একবারে একটি কাজ। ফিরে আসা সহজ।',
      'skip': 'মূল অংশে যান',
      'lang.toggle': 'English',
      'lang.toggle.label': 'ভাষা ইংরেজিতে বদলান',

      'nav.label': 'প্রধান',
      'nav.focus': 'মনোযোগ',
      'nav.capture': 'লিখে রাখুন',
      'nav.handoff': 'হস্তান্তর',
      'nav.settings': 'সেটিংস',
      'nav.help': 'কিবোর্ড সাহায্য',

      'interrupt.button': 'আমি বাধা পেয়েছি',

      'capture.title': 'মাথা খালি করুন',
      'capture.lead': 'মনে যা আছে সব লিখুন। প্রতি লাইনে একটি কাজ, এলোমেলো হলেও চলবে। আমরা ছোট ছোট ধাপে ভাগ করে দেব।',
      'capture.label': 'মনের কথা',
      'capture.placeholder': 'রিপোর্ট লিখতে হবে\nস্যারকে ইমেইল পাঠাতে হবে\nরসায়ন নোট পড়তে হবে',
      'capture.submit': 'ধাপ বানান',
      'capture.demo': 'ডেমো দেখুন',
      'capture.demo.hint': 'রাফিকে দেখুন — অর্ধেক লেখা রিপোর্টে ফিরে আসা এক শিক্ষার্থী।',
      'capture.preview': 'যা পাওয়া গেল',
      'capture.start': 'প্রথমটি দিয়ে শুরু করুন',
      'capture.empty': 'আগে অন্তত একটি কাজ লিখুন।',

      'focus.title': 'এখন',
      'focus.eyebrow': 'আপনার একটি ধাপ',
      'focus.task': 'কাজ: {task}',
      'focus.progress': '{total}টির মধ্যে {done}টি ধাপ শেষ',
      'focus.done': 'শেষ',
      'focus.notnow': 'এখন না',
      'focus.stuck': 'আটকে গেছি',
      'focus.read': 'পড়ে শোনান',
      'focus.empty.title': 'কিছু বাকি নেই',
      'focus.empty.body': 'তালিকা খালি। প্রস্তুত হলে নতুন কিছু লিখে রাখুন।',
      'focus.taskdone': 'কাজটি শেষ। একটু বিশ্রাম নিন।',
      'focus.split': 'ছোট করা হলো: দুটি সহজ ধাপ।',
      'focus.later': 'পরে রাখা হলো। কোনো সমস্যা নেই।',

      'interrupt.title': 'যেখানে থামলেন তা রাখুন',
      'interrupt.lead': 'নিজের ভাষায় বলুন কোথায় থেমেছেন। এরপরই যেতে পারবেন।',
      'interrupt.label': 'কোথায় থেমেছেন?',
      'interrupt.placeholder': 'আমি রিপোর্ট করছিলাম। প্রথম দুটি সেকশন শেষ করেছি। তৃতীয় সেকশন বাকি।',
      'interrupt.voice': 'মুখে বলুন',
      'interrupt.voice.stop': 'শোনা বন্ধ করুন',
      'interrupt.voice.unsupported': 'এই ব্রাউজারে ভয়েস ইনপুট নেই। লিখেও একইভাবে কাজ হবে।',
      'interrupt.save': 'রেখে যান',
      'interrupt.cancel': 'আমার ধাপে ফিরুন',
      'interrupt.saved.title': 'রাখা হয়েছে। যান।',
      'interrupt.saved.body': 'সব এখানে আছে। ফিরে এলে ঠিক কোথায় ছিলেন দেখতে পাবেন।',
      'interrupt.back': 'আমি ফিরে এসেছি',

      'recovery.title': 'আবার স্বাগতম',
      'recovery.away': 'আপনি {time} দূরে ছিলেন।',
      'recovery.reason': 'থামার কারণ: {reason}',
      'recovery.done': 'শেষ হয়েছে',
      'recovery.todo': 'এখনো বাকি',
      'recovery.next': 'পরের একটি ছোট ধাপ',
      'recovery.thought': 'আপনার শেষ ভাবনা',
      'recovery.start': 'এই ধাপ শুরু করুন',
      'recovery.handoff': 'হস্তান্তর নোট বানান',
      'recovery.none': 'এখনো কিছু নেই',

      'handoff.title': 'হস্তান্তর সারাংশ',
      'handoff.lead': 'ছোট একটি নোট, যা সহপাঠী (বা পরের আপনি) দশ সেকেন্ডে পড়তে পারবে।',
      'handoff.label': 'সারাংশ',
      'handoff.copy': 'কপি করুন',
      'handoff.copied': 'কপি হয়েছে।',
      'handoff.copyfail': 'কপি হয়নি। লেখাটি নির্বাচন করে নিজে কপি করুন।',
      'handoff.empty': 'আগে একটি বাধা সংরক্ষণ করুন, তাহলে সারাংশ এখানে আসবে।',

      'settings.title': 'সেটিংস',
      'settings.display': 'আরাম ও প্রদর্শন',
      'settings.theme': 'থিম',
      'settings.theme.calm': 'শান্ত আলো',
      'settings.theme.dark': 'শান্ত অন্ধকার',
      'settings.theme.contrast': 'উচ্চ কনট্রাস্ট',
      'settings.largeText': 'বড় লেখা',
      'settings.dyslexia': 'ডিসলেক্সিয়া-বান্ধব ফন্ট',
      'settings.spacing': 'লাইনের মাঝে বেশি ফাঁকা',
      'settings.reduceMotion': 'নড়াচড়া কমান',
      'settings.voice': 'পড়ে শোনানো',
      'settings.rate': 'কথার গতি',
      'settings.ai': 'ঐচ্ছিক AI সাহায্য',
      'settings.ai.lead': 'আরও ভালো বোঝার জন্য নিজের Gemini API কী দিন। এটি শুধু এই ব্রাউজারে থাকে। না দিলেও সব অফলাইনে চলবে।',
      'settings.ai.key': 'Gemini API কী',
      'settings.ai.save': 'কী সংরক্ষণ',
      'settings.ai.clear': 'কী মুছুন',
      'settings.ai.saved': 'কী এই ব্রাউজারে সংরক্ষিত হয়েছে।',
      'settings.ai.cleared': 'কী মুছে ফেলা হয়েছে।',
      'settings.data': 'আপনার তথ্য',
      'settings.reset': 'সব মুছুন',
      'settings.reset.confirm': 'এই ব্রাউজার থেকে সব কাজ ও নোট মুছে যাবে। চালিয়ে যাবেন?',
      'settings.reset.done': 'সব তথ্য মুছে ফেলা হয়েছে।',
      'settings.storage.memory': 'এই ব্রাউজারে স্টোরেজ বন্ধ, তাই ট্যাব বন্ধ করা পর্যন্ত তথ্য থাকবে।',

      'help.title': 'কিবোর্ড শর্টকাট',
      'help.close': 'বন্ধ করুন',
      'help.k.enter': 'বর্তমান ধাপ শেষ',
      'help.k.s': 'আটকে গেছি: ধাপ ভাগ করুন',
      'help.k.n': 'এখন না: ধাপ পরে রাখুন',
      'help.k.r': 'কার্ডটি পড়ে শোনান',
      'help.k.i': 'বাধা পেয়েছি: অবস্থান রাখুন',
      'help.k.help': 'এই সাহায্য দেখান',
      'help.k.esc': 'ডায়ালগ বন্ধ বা পেছনে যান',
      'help.note': 'টেক্সট বক্সে লেখার সময় শর্টকাট বন্ধ থাকে।',

      'time.minutes': '{n} মিনিট',
      'time.hours': '{n} ঘণ্টা {m} মিনিট',
      'time.justnow': 'অল্প সময়',
    },
  };

  let current = 'en';

  /** @param {'en'|'bn'} lang */
  function setLang(lang) {
    current = STRINGS[lang] ? lang : 'en';
    document.documentElement.lang = current === 'bn' ? 'bn' : 'en';
  }
  const getLang = () => current;

  /** Translate a key; fills {placeholders}; Bangla digits for numbers when lang is bn. */
  function t(key, vars) {
    let s = (STRINGS[current] && STRINGS[current][key]) || STRINGS.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        let v = vars[k];
        if (typeof v === 'number' && current === 'bn') v = String(v).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
        s = s.split('{' + k + '}').join(String(v));
      });
    }
    return s;
  }

  /** Apply translations to every [data-i18n] / [data-i18n-attr] element under root. */
  function apply(rootEl) {
    const r = rootEl || document;
    r.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
    r.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.dataset.i18nAttr.split(';').forEach((pair) => {
        const [attr, key] = pair.split(':').map((x) => x.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
  }

  root.I18N = { STRINGS, t, apply, setLang, getLang };
})(typeof self !== 'undefined' ? self : this);
