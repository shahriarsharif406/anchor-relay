/*
 * Anchor Relay — offline, deterministic rule engine.
 * No network, no randomness: the same input always gives the same output.
 * Works in the browser (window.AnchorEngine) and in Node (require('./engine.js')).
 *
 * Public API
 *   detectLang(text)                  -> 'en' | 'bn'
 *   splitBrainDump(text, lang?)       -> [{ title, steps: [string] }]
 *   parseStatus(text, lang?)          -> { lang, subject, done[], pending[], reason, lastThought, urgent }
 *   nextTinyStep(item, subject, lang) -> string
 *   splitStep(step, lang)             -> [string, string]   (step = { text, base?, depth? } or string)
 *   handoffSummary(ctx, lang)         -> string (plain text, copyable)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AnchorEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- helpers ---------- */

  // Bangla "য়" can be one code point or two; NFC both input and patterns so they always match.
  const nfc = (s) => (s || '').normalize('NFC');
  const bnRe = (src, flags) => new RegExp(nfc(src), flags || '');

  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
  const toBnDigits = (n) => String(n).replace(/\d/g, (d) => BN_DIGITS[d]);
  const fromBnDigits = (s) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const tidy = (s) =>
    (s || '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,.;:!?।\-–—]+|[\s,.;:!?।\-–—]+$/g, '')
      .trim();
  const uniq = (arr) => {
    const seen = new Set();
    return arr.filter((x) => {
      const k = x.toLowerCase();
      if (!x || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  function detectLang(text) {
    const s = text || '';
    const bn = (s.match(/[ঀ-৿]/g) || []).length;
    const lat = (s.match(/[A-Za-z]/g) || []).length;
    return bn > 0 && bn * 2 >= lat ? 'bn' : 'en';
  }

  /* ---------- marker vocabularies ---------- */

  const M = {
    en: {
      thought: /\b(last thought|i was about to|i was going to|next i (?:wanted|was going) to|my idea was|note to self|remember to)\b/i,
      pendingStrong: /\b(left|remaining|remains?|pending|still|not (?:yet|done|finished|started)|haven'?t|have not|hasn'?t|yet to|unfinished|incomplete|to ?do)\b/i,
      interrupt: /\b(meeting|call|calling|urgent|interrupt(?:ed|ion)?|emergency|gotta go|have to go|need to go|must go|class starts?|lecture|door|phone|someone needs me)\b/i,
      pendingWeak: /\b(need to|needs to|have to|has to|must|next up|should)\b/i,
      done: /\b(finished|finish|done|completed?|wrote|written|did|sent|submitted|drafted|got through|wrapped up|ticked off|fixed|read)\b/i,
      context: /\b(?:i was|i'm|i am|we were)\s+(?:working on|writing|doing|reading|studying|preparing|making|editing|coding|finishing)\s+(.+)/i,
      urgent: /\b(urgent|asap|emergency|right now|immediately)\b/i,
    },
    bn: {
      thought: bnRe('ভাবছিলাম|ভাবনা ছিল|যাচ্ছিলাম|চাচ্ছিলাম|মনে রাখতে হবে'),
      pendingStrong: bnRe('বাকি|হয়নি|হয় নি|করিনি|করি নি|লিখিনি|এখনো|এখনও|অসম্পূর্ণ'),
      interrupt: bnRe('মিটিং|জরুরি|জরুরী|ফোন|কল এসেছে|ডাকছে|ডেকেছে|যেতে হবে|ক্লাস|বাধা|ইন্টারাপ্ট'),
      pendingWeak: bnRe('(?:করতে|লিখতে|পড়তে|পাঠাতে|দিতে|শেষ করতে)\\s*হবে'),
      done: bnRe('শেষ করেছি|শেষ হয়েছে|শেষ হয়ে গেছে|হয়ে গেছে|করে ফেলেছি|করেছি|সম্পন্ন|লিখেছি|পাঠিয়েছি|পড়েছি|জমা দিয়েছি|শেষ'),
      context: bnRe('^(?:আমি\\s+|আমরা\\s+)?(.+?)\\s+(?:করছিলাম|লিখছিলাম|পড়ছিলাম|বানাচ্ছিলাম|তৈরি করছিলাম)'),
      urgent: bnRe('জরুরি|জরুরী|এখনই|এক্ষুনি'),
    },
  };

  function classify(clause, lang) {
    const m = M[lang];
    if (m.thought.test(clause)) return 'thought';
    if (m.context.test(clause) && !m.done.test(clause.replace(m.context, ''))) return 'context';
    if (m.pendingStrong.test(clause)) return 'pending';
    if (m.interrupt.test(clause)) return 'interrupt';
    if (m.pendingWeak.test(clause)) return 'pending';
    if (m.done.test(clause)) return 'done';
    return null;
  }
  const hasMarker = (c, lang) => classify(c, lang) !== null;

  /* ---------- clause splitting ---------- */

  const SEP = '\u0001';

  function splitClauses(text, lang) {
    const t = nfc(text)
      .replace(/\r/g, '')
      .replace(/([.!?।])\s+/g, '$1' + SEP)
      .replace(/\n+|;+/g, SEP)
      .replace(/\s+(?:but|however|and then|then)\s+/gi, SEP)
      .replace(bnRe('\\s+(?:কিন্তু|তবে|তারপর)\\s+', 'g'), SEP);
    const out = [];
    t.split(SEP).forEach((sentence) => {
      // Split on commas / "and" — then glue back fragments that carry no marker of their
      // own, so "finished sections 1, 2 and 3" stays one clause.
      const parts = sentence.split(lang === 'bn' ? bnRe(',|،|\\s+এবং\\s+|\\s+আর\\s+') : /,|\s+and\s+|\s+&\s+/i);
      const merged = [];
      parts.forEach((p) => {
        const s = tidy(p);
        if (!s) return;
        if (merged.length && !hasMarker(s, lang)) merged[merged.length - 1] += (lang === 'bn' ? ' ও ' : ' and ') + s;
        else merged.push(s);
      });
      out.push(...merged);
    });
    return out.filter(Boolean);
  }

  /* ---------- structured items: "sections 1 and 2", "প্রথম দুটি সেকশন" ---------- */

  const EN_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const EN_ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6 };
  const EN_UNIT = 'sections?|parts?|chapters?|questions?|slides?|pages?|problems?|exercises?|steps?';
  const BN_ORD = { প্রথম: 1, দ্বিতীয়: 2, তৃতীয়: 3, চতুর্থ: 4, পঞ্চম: 5, ষষ্ঠ: 6 };
  const BN_COUNT = { দুটি: 2, দুইটি: 2, দুটো: 2, দুই: 2, তিনটি: 3, তিনটা: 3, তিন: 3, চারটি: 4, চার: 4, পাঁচটি: 5, পাঁচ: 5 };
  const BN_UNIT = 'সেকশন|অংশ|অধ্যায়|প্রশ্ন|স্লাইড|পৃষ্ঠা|পাতা|পর্ব|ধাপ';

  const enLabel = (unit, n) => cap(unit.toLowerCase().replace(/s$/, '')) + ' ' + n;
  const bnLabel = (unit, n) => unit + ' ' + toBnDigits(n);

  function numList(src, lang) {
    // "1, 2 and 3" | "1-3" | "1 to 3" | "১ ও ২"
    const s = fromBnDigits(src).toLowerCase();
    const range = s.match(/(\d+)\s*(?:-|–|to|থেকে)\s*(\d+)/);
    if (range) {
      const a = +range[1], b = +range[2], r = [];
      for (let i = a; i <= b && r.length < 12; i++) r.push(i);
      return r;
    }
    return (s.match(/\d+|one|two|three|four|five|six/g) || []).map((x) => (EN_NUM[x] ? EN_NUM[x] : +x));
  }

  function expandItems(clause, lang) {
    const c = nfc(clause);
    const items = [];
    if (lang === 'en') {
      let m;
      const firstN = new RegExp('\\b(?:first|last)\\s+(two|three|four|five|\\d+)\\s+(' + EN_UNIT + ')', 'i');
      if ((m = c.match(firstN))) {
        const n = EN_NUM[m[1].toLowerCase()] || +m[1];
        for (let i = 1; i <= n; i++) items.push(enLabel(m[2], i));
        return items;
      }
      const ord = new RegExp('\\b(first|second|third|fourth|fifth|sixth)\\s+(' + EN_UNIT + ')', 'gi');
      while ((m = ord.exec(c))) items.push(enLabel(m[2], EN_ORD[m[1].toLowerCase()]));
      const nums = new RegExp(
        '\\b(' + EN_UNIT + ')\\s*((?:\\d+|one|two|three|four|five|six)(?:\\s*(?:,|and|&|to|-|–)\\s*(?:\\d+|one|two|three|four|five|six))*)',
        'gi'
      );
      while ((m = nums.exec(c))) numList(m[2], lang).forEach((n) => items.push(enLabel(m[1], n)));
    } else {
      let m;
      const firstN = bnRe('প্রথম\\s+(' + Object.keys(BN_COUNT).join('|') + '|[০-৯\\d]+টি?)\\s*(' + BN_UNIT + ')');
      if ((m = c.match(firstN))) {
        const n = BN_COUNT[m[1]] || +fromBnDigits(m[1].replace(/টি$/, ''));
        for (let i = 1; i <= n; i++) items.push(bnLabel(m[2], i));
        return items;
      }
      const ord = bnRe('(' + Object.keys(BN_ORD).join('|') + ')\\s*(' + BN_UNIT + ')', 'g');
      while ((m = ord.exec(c))) items.push(bnLabel(m[2], BN_ORD[nfc(m[1])] || BN_ORD[m[1]]));
      const nums = bnRe('(' + BN_UNIT + ')\\s*([০-৯\\d]+(?:\\s*(?:,|ও|এবং|আর|-|থেকে)\\s*[০-৯\\d]+)*)', 'g');
      while ((m = nums.exec(c))) numList(m[2], lang).forEach((n) => items.push(bnLabel(m[1], n)));
    }
    return uniq(items);
  }

  // Remove the structured spans so the remainder can be scanned for free-text items.
  function stripStructured(clause, lang) {
    const c = nfc(clause);
    if (lang === 'en') {
      const N = '(?:\\d+|one|two|three|four|five|six)';
      return c
        .replace(new RegExp('\\b(?:first|last)\\s+(?:two|three|four|five|\\d+)\\s+(?:' + EN_UNIT + ')', 'gi'), ',')
        .replace(new RegExp('\\b(?:first|second|third|fourth|fifth|sixth)\\s+(?:' + EN_UNIT + ')', 'gi'), ',')
        .replace(new RegExp('\\b(?:' + EN_UNIT + ')\\s*' + N + '(?:\\s*(?:,|and|&|to|-|–)\\s*' + N + ')*', 'gi'), ',');
    }
    return c
      .replace(bnRe('প্রথম\\s+(?:' + Object.keys(BN_COUNT).join('|') + '|[০-৯\\d]+টি?)\\s*(?:' + BN_UNIT + ')', 'g'), ',')
      .replace(bnRe('(?:' + Object.keys(BN_ORD).join('|') + ')\\s*(?:' + BN_UNIT + ')', 'g'), ',')
      .replace(bnRe('(?:' + BN_UNIT + ')\\s*[০-৯\\d]+(?:\\s*(?:,|ও|এবং|আর|-|থেকে)\\s*[০-৯\\d]+)*', 'g'), ',');
  }

  // Normalise the keys of BN_ORD once (source may hold decomposed "য়").
  Object.keys(BN_ORD).forEach((k) => (BN_ORD[nfc(k)] = BN_ORD[k]));

  /* ---------- free-text item cleaning ---------- */

  const EN_STRIP = [
    /^(?:and|but|so|also|ok(?:ay)?|well)\s+/i,
    /\b(?:i|i've|i'm|i am|i have|we|we've|we have|my)\b/gi,
    /\b(?:already|just|now|yet|still|is|are|was|were|been|has|have|got)\b/gi,
    /\b(?:left|remaining|remains?|pending|not (?:yet|done|finished|started)|haven'?t|have not|yet to|unfinished|incomplete|to ?do)\b/gi,
    /\b(?:need to|needs to|have to|has to|must|should|next up)\b/gi,
    /\b(?:finished|finish|done|completed?|got through|wrapped up)\b/gi,
  ];

  function cleanItem(clause, lang, kind) {
    let s = nfc(clause);
    if (lang === 'bn') {
      s = s.replace(bnRe('^(?:আমি|আমরা|আর|এবং)\\s+'), '');
      if (kind === 'pending') s = s.replace(bnRe('\\s*(?:এখনো|এখনও)?\\s*বাকি(?:\\s*আছে)?'), '');
      if (kind === 'done') s = s.replace(bnRe('\\s*(?:শেষ করেছি|শেষ হয়েছে|শেষ হয়ে গেছে|হয়ে গেছে)'), '');
      return tidy(s);
    }
    // Keep verbs like "write"/"send" for pending items: "I still need to write the conclusion" -> "Write the conclusion".
    EN_STRIP.forEach((re) => (s = s.replace(re, ' ')));
    return cap(tidy(tidy(s).replace(/^(?:the|my|a|an|and|of|with)(?:\s+|$)/i, '')));
  }

  /* ---------- status parsing ---------- */

  function parseStatus(text, langHint) {
    const raw = nfc(text || '');
    const lang = langHint || detectLang(raw);
    const m = M[lang];
    const res = { lang, subject: '', done: [], pending: [], reason: '', lastThought: '', urgent: m.urgent.test(raw) };

    splitClauses(raw, lang).forEach((clause) => {
      const kind = classify(clause, lang);
      if (kind === 'context') {
        const cm = clause.match(m.context);
        if (cm && !res.subject) res.subject = tidy(cm[1].replace(/^(?:the|my|a|an)\s+/i, ''));
        return;
      }
      if (kind === 'thought') {
        res.lastThought = tidy(clause);
        return;
      }
      if (kind === 'interrupt') {
        res.reason = res.reason ? res.reason + '; ' + tidy(clause) : tidy(clause);
        return;
      }
      if (kind === 'done' || kind === 'pending') {
        // Structured items ("sections 1 and 2") plus any free-text leftovers ("the intro").
        const structured = expandItems(clause, lang);
        const rest = structured.length ? stripStructured(clause, lang) : clause;
        const free = (structured.length ? rest.split(lang === 'bn' ? bnRe(',|،|\\s+এবং\\s+|\\s+ও\\s+|\\s+আর\\s+') : /,|\s+and\s+|\s+&\s+/i) : [rest])
          .map((f) => cleanItem(f, lang, kind))
          .filter((x) => x && x.replace(/[^\p{L}]/gu, '').length > 2);
        res[kind].push(...free, ...structured);
      }
    });

    res.done = uniq(res.done);
    // If something is both done and pending, trust "pending" less: done wins only on exact match.
    res.pending = uniq(res.pending).filter((p) => !res.done.some((d) => d.toLowerCase() === p.toLowerCase()));
    return res;
  }

  /* ---------- next tiny step ---------- */

  const KIND = [
    ['slides', 'slide|presentation|deck|স্লাইড|প্রেজেন্টেশন'],
    ['email', 'e-?mail|mail|message|reply|ইমেইল|মেইল|বার্তা|মেসেজ|চিঠি'],
    ['question', 'question|problem|exercise|\\bq\\d|প্রশ্ন|অংক|সমস্যা'],
    ['code', 'code|bug|function|script|test|কোড|প্রোগ্রাম'],
    ['read', '\\bread|article|paper|revise|study|notes|flashcard|পড়|নোট|রিভিশন'],
    ['write', 'section|chapter|part|essay|report|intro|conclusion|paragraph|draft|write|সেকশন|অংশ|অধ্যায়|লেখা|লিখ|রিপোর্ট|উপসংহার|ভূমিকা|প্রবন্ধ'],
  ].map(([k, src]) => [k, bnRe(src, 'i')]);
  const UNIT_RE = bnRe('section|chapter|part|সেকশন|অংশ|অধ্যায়', 'i');
  const kindOf = (s) => {
    const n = nfc(s);
    const k = KIND.find(([, re]) => re.test(n));
    return k ? k[0] : 'generic';
  };

  const NEXT = {
    en: {
      write: (i, s) => `Open ${s ? 'the ' + s : 'your document'} and write one rough sentence for ${i}.`,
      read: (i) => `Open ${i} and read only the first paragraph.`,
      email: (i) => `Write just the subject line for: ${i}.`,
      slides: (i) => `Write only the title of ${i}.`,
      question: (i) => `Read ${i} once, slowly, and underline what it asks.`,
      code: (i) => `Open the file for ${i} and find the line where you stopped.`,
      generic: (i) => `Set a 2-minute timer and do only the first move of: ${i}.`,
      none: (s) => `Look over ${s ? 'the ' + s : 'what you finished'} for one minute, then choose the next small piece.`,
    },
    bn: {
      write: (i, s) => `${s || 'ফাইলটি'} খুলুন এবং ${i}-এর জন্য একটি কাঁচা বাক্য লিখুন।`,
      read: (i) => `${i} খুলুন এবং শুধু প্রথম অনুচ্ছেদটি পড়ুন।`,
      email: (i) => `শুধু বিষয়ের লাইনটি লিখুন: ${i}।`,
      slides: (i) => `${i}-এর শুধু শিরোনামটি লিখুন।`,
      question: (i) => `${i} একবার ধীরে পড়ুন এবং কী চাওয়া হয়েছে তা দাগ দিন।`,
      code: (i) => `${i}-এর ফাইলটি খুলুন এবং যেখানে থেমেছিলেন সেই লাইনটি খুঁজুন।`,
      generic: (i) => `২ মিনিটের টাইমার দিন এবং শুধু প্রথম কাজটি করুন: ${i}।`,
      none: (s) => `${s || 'যা শেষ করেছেন'} এক মিনিট দেখে নিন, তারপর পরের ছোট অংশটি বেছে নিন।`,
    },
  };

  function nextTinyStep(item, subject, lang) {
    const L = NEXT[lang === 'bn' ? 'bn' : 'en'];
    if (!item) return L.none(subject);
    // A section of a report is a writing task even if the item itself is just "Section 3".
    let k = kindOf(item);
    if (k === 'generic' && subject) k = kindOf(subject);
    if (k === 'write' && !UNIT_RE.test(nfc(item)) && kindOf(item) === 'write') {
      // e.g. "Write the conclusion" — already a verb phrase
      return lang === 'bn' ? NEXT.bn.write(item, subject) : `Open ${subject ? 'the ' + subject : 'your document'} and write one rough sentence of ${item.replace(/^write\s+/i, '').replace(/^the\s+/i, 'the ')}.`;
    }
    return L[k](item, subject);
  }

  /* ---------- "I'm stuck" splitting ---------- */

  function splitStep(step, lang) {
    const st = typeof step === 'string' ? { text: step } : step;
    const text = tidy(nfc(st.text));
    const base = st.base || text;
    const depth = st.depth || 0;
    const bn = lang === 'bn' || detectLang(text) === 'bn';

    // 1) Natural seam in the sentence: "outline and draft", "এটা এবং ওটা".
    const seam = bn ? bnRe('\\s+(?:এবং|ও|তারপর|আর)\\s+|,\\s*') : /\s+(?:and then|and|then)\s+|,\s*/i;
    const parts = text.split(seam).map(tidy).filter((p) => p.length > 2);
    if (parts.length >= 2) return [cap(parts[0]), cap(parts.slice(1).join(bn ? ' এবং ' : ' and '))];

    // 2) Tiers, each one gentler than the last. `base` keeps quotes from nesting.
    if (bn) {
      if (depth === 0) return [`প্রস্তুতি: “${base}”-এর জন্য যা লাগবে খুলে রাখুন`, `“${base}”-এর প্রথম ২ মিনিট করুন, তারপর থামুন`];
      if (depth === 1) return [`“${base}”-এর জন্য শুধু একটি ফাইল বা পাতা খুঁজে বের করুন`, `সেটি সামনে রাখুন এবং একবার ধীরে শ্বাস নিন`];
      return [`শুধু ৩০ সেকেন্ড তাকিয়ে থাকুন — কিছু করতে হবে না`, `একটি ছোট, অসম্পূর্ণ কাজ করুন — এলোমেলো হলেও চলবে`];
    }
    if (depth === 0) return [`Get ready: open what you need for “${base}”`, `Do the first 2 minutes of “${base}”, then stop`];
    if (depth === 1) return [`Find the one file or page for “${base}”`, `Put it on screen and take one slow breath`];
    return [`Just look at it for 30 seconds — nothing to do yet`, `Make one tiny, imperfect move — messy is fine`];
  }

  /* ---------- brain dump -> tasks ---------- */

  const STEPS = {
    en: {
      write: ['Jot a rough outline (three bullets)', 'Write the first messy paragraph', 'Read it once and fix one thing'],
      read: ['Open it and skim the headings', 'Read the first section only', 'Write one sentence about what you learned'],
      email: ['Write the subject line', 'Write two or three short sentences', 'Read it once, then send'],
      slides: ['Write the title of each slide', 'Fill in the first slide', 'Click through once from the start'],
      question: ['Read the question slowly', 'Write down what you already know', 'Try the first small part'],
      code: ['Open the file and find where to start', 'Change one small thing', 'Run it and check'],
      generic: ['Open what you need', 'Do the first small part', 'Check it and mark it done'],
    },
    bn: {
      write: ['একটি খসড়া রূপরেখা লিখুন (তিনটি পয়েন্ট)', 'প্রথম এলোমেলো অনুচ্ছেদটি লিখুন', 'একবার পড়ুন এবং একটি জিনিস ঠিক করুন'],
      read: ['খুলুন এবং শিরোনামগুলো দেখুন', 'শুধু প্রথম অংশটি পড়ুন', 'যা শিখলেন তা এক বাক্যে লিখুন'],
      email: ['বিষয়ের লাইনটি লিখুন', 'দুই-তিনটি ছোট বাক্য লিখুন', 'একবার পড়ুন, তারপর পাঠান'],
      slides: ['প্রতিটি স্লাইডের শিরোনাম লিখুন', 'প্রথম স্লাইডটি পূরণ করুন', 'শুরু থেকে একবার দেখে নিন'],
      question: ['প্রশ্নটি ধীরে পড়ুন', 'যা জানেন তা লিখে ফেলুন', 'প্রথম ছোট অংশটি চেষ্টা করুন'],
      code: ['ফাইলটি খুলুন এবং শুরুর জায়গা খুঁজুন', 'একটি ছোট পরিবর্তন করুন', 'চালিয়ে দেখুন'],
      generic: ['যা লাগবে তা খুলুন', 'প্রথম ছোট অংশটি করুন', 'দেখে নিন এবং শেষ চিহ্ন দিন'],
    },
  };

  function cleanTaskTitle(s, lang) {
    let t = tidy(nfc(s).replace(/^\s*(?:[-*•▪◦]|\d+[.)]|[০-৯]+[.)])\s*/, ''));
    if (lang === 'en') t = t.replace(/^(?:i\s+)?(?:need to|have to|must|should|want to|gotta)\s+/i, '').replace(/^(?:and|also|then)\s+/i, '');
    else t = t.replace(bnRe('^(?:তারপর|এবং|আর|আমাকে|আমার|আমি)\\s+'), '').replace(bnRe('^(?:আমাকে|আমি)\\s+'), '');
    return cap(tidy(t));
  }

  function stepsFor(title, lang) {
    // "Report: intro, methods, results"  -> those become the steps
    const colon = title.match(/^([^:：]{2,60})[:：]\s*(.+)$/);
    if (colon) {
      const sub = colon[2].split(lang === 'bn' ? bnRe(',|،|\\s+এবং\\s+|\\s+ও\\s+') : /,|\s+and\s+|\s+&\s+/i).map((x) => cap(tidy(x))).filter(Boolean);
      if (sub.length >= 2) return { title: cap(tidy(colon[1])), steps: sub };
    }
    const items = expandItems(title, lang);
    if (items.length >= 2) return { title, steps: items };
    return { title, steps: STEPS[lang][kindOf(title)].slice() };
  }

  function splitBrainDump(text, langHint) {
    const raw = nfc(text || '');
    const lang = langHint || detectLang(raw);
    let segs = raw.split(/\n+|;+/).map((s) => s.trim()).filter(Boolean);
    // A single run-on line: split on sentence ends, "then", and commas (unless it is a "Title: a, b" line).
    if (segs.length === 1 && !/[:：]/.test(segs[0])) {
      segs = segs[0]
        .split(lang === 'bn' ? bnRe('[।.!?]\\s*|,\\s*|\\s+(?:তারপর|এবং তারপর|আর)\\s+') : /[.!?]\s+|,\s*|\s+(?:and then|then|and also|also)\s+/i)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const titles = uniq(segs.map((s) => cleanTaskTitle(s, lang)).filter((s) => s.length > 1)).slice(0, 12);
    return titles.map((t) => stepsFor(t, lang));
  }

  /* ---------- handoff summary ---------- */

  const HL = {
    en: { head: 'Handoff', saved: 'saved', done: 'Done', todo: 'Still to do', next: 'Next tiny step', thought: 'Last thought', why: 'Why I stopped', none: '(nothing yet)' },
    bn: { head: 'হস্তান্তর', saved: 'সংরক্ষিত', done: 'শেষ হয়েছে', todo: 'এখনো বাকি', next: 'পরের ছোট ধাপ', thought: 'শেষ ভাবনা', why: 'কেন থেমেছি', none: '(এখনো কিছু নেই)' },
  };

  function handoffSummary(ctx, lang) {
    const L = HL[lang === 'bn' ? 'bn' : 'en'];
    const c = ctx || {};
    const list = (a) => (a && a.length ? a.map((x) => '- ' + x).join('\n') : L.none);
    const when = c.at ? ` (${L.saved} ${new Date(c.at).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })})` : '';
    const lines = [`${L.head}${c.subject ? ' — ' + c.subject : ''}${when}`, '', `${L.done}:`, list(c.done), '', `${L.todo}:`, list(c.pending), '', `${L.next}: ${c.next || L.none}`];
    if (c.lastThought) lines.push(`${L.thought}: ${c.lastThought}`);
    if (c.reason) lines.push(`${L.why}: ${c.reason}`);
    return lines.join('\n');
  }

  return { detectLang, splitClauses, expandItems, parseStatus, nextTinyStep, splitStep, splitBrainDump, handoffSummary, kindOf, toBnDigits };
});
