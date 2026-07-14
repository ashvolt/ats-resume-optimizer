# Development Plan — ATS Resume Optimizer

**Status:** v0.1 (prototype) → v1.0 (production-ready)  
**Last updated:** June 2026

---

## Executive Summary

The current prototype has a fundamentally broken keyword extraction pipeline. Test results (see `test_scraping.js`) prove that the bigram generator creates junk tokens like `"developer. skills"` and `"5+ typescript"` by crossing sentence boundaries — meaning **tech terms score 0 out of 20** in real job descriptions. The paraphrase engine has Pragash-specific hardcoded strings and injects grammatically awkward text. Neither module is production-ready.

This plan defines the intelligence redesign across three phases.

---

## Test Results — What We Proved is Broken

Running `node test_scraping.js` against five realistic job board HTML structures revealed:

| Issue | Severity | Evidence |
|-------|----------|---------|
| Bigrams cross sentence boundaries | Critical | `"engineer. 5+"`, `"developer. skills"`, `"3+ rest"` in top keywords |
| Tokens include trailing punctuation | Critical | Tokens like `"developer."` and `"5+"` pass the filter unchanged |
| Tech terms match rate = 0% | Critical | 0/20 top keywords were verified tech terms (Indeed, Sticker Mule tests) |
| JD noise leaks into keywords | High | `"passionate"`, `"startup"`, `"culture"` appear in top-30 for noisy JDs |
| Section weighting not implemented | High | Benefits/perks text weighted equally to Requirements |
| `allorigins.win` fails on LinkedIn, Workday | Medium | Both return empty/blocked responses |

---

## Phase 1 — Fix the Tokenizer and Keyword Engine

**Goal:** Make tech terms reliably surface as top keywords for any JD.  
**Timeline:** 2–3 days

### 1.1 Tokenizer rewrite

**Problem:**  
The current tokenizer keeps `.` characters (for `node.js`) but this causes sentence-boundary tokens like `"developer."`, `"services."`, `"required."`. These then form garbage bigrams across sentence boundaries.

**Fix — two-pass approach:**

```
Pass 1: Split text into SENTENCES first (split on . ; : ! ? \n)
Pass 2: Tokenize each sentence independently → bigrams never cross sentences
```

```javascript
// NEW: sentence-aware tokenizer
function tokenizeSentences(text) {
  // Split on sentence boundaries FIRST
  const sentences = text
    .replace(/([.;:!?\n])\s*/g, '$1\n')  // normalize sentence ends → newline
    .split('\n')
    .filter(s => s.trim().length > 2);
  
  return sentences.map(sentence => 
    sentence
      .toLowerCase()
      .replace(/\b(\w+)\.js\b/g, '$1js')   // node.js → nodejs, next.js → nextjs
      .replace(/\bc\+\+/g, 'cpp')           // c++ → cpp for safe tokenizing
      .replace(/[^a-z0-9\s\+\#\/\-]/g, ' ')// strip remaining punctuation
      .split(/\s+/)
      .filter(t => t.length > 1 && !SW.has(t))
  );
}

function extractKeywords(text) {
  const sentences = tokenizeSentences(text);
  const freq = {};
  
  for (const tokens of sentences) {
    // Unigrams
    tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    
    // Bigrams ONLY within same sentence (never cross boundaries)
    for (let i = 0; i < tokens.length - 1; i++) {
      const bg = `${tokens[i]} ${tokens[i+1]}`;
      freq[bg] = (freq[bg] || 0) + 1.5;
    }
  }
  
  return freq;
}
```

**Tech term normalisation map:**

```javascript
const NORMALISE = {
  'nodejs': 'node.js', 'nextjs': 'next.js', 'nuxtjs': 'nuxt.js',
  'reactjs': 'react',  'vuejs': 'vue',      'cpp': 'c++',
  'k8s': 'kubernetes', 'gke': 'gcp',        'postgres': 'postgresql',
  'psql': 'postgresql','pg': 'postgresql',  'mongo': 'mongodb',
  'ts': 'typescript',  'js': 'javascript',  'py': 'python',
};
```

### 1.2 JD section parser and section weighting

**Problem:** Benefits/perks/culture text is weighted the same as Requirements.

**Design:**

```
Detected section     → Weight multiplier
─────────────────────────────────────────
Requirements         → 2.0×  (must-have skills)
What you'll do       → 1.5×  (primary responsibilities)
Preferred / Nice-to-have → 0.5× (good-to-have)
About us / Benefits  → 0×    (skip entirely)
Default / unclassified → 1.0×
```

```javascript
const SECTION_WEIGHTS = [
  { re: /\b(requirements?|must.have|qualifications?|you.will.need)\b/i,  w: 2.0 },
  { re: /\b(what you.ll do|responsibilities|you will)\b/i,               w: 1.5 },
  { re: /\b(nice.to.have|preferred|bonus|good.to.have|plus)\b/i,         w: 0.5 },
  { re: /\b(about.us|why.join|benefits|perks|what.we.offer|compensation|salary|pto|insurance)\b/i, w: 0   },
];

function parseJDSections(jdText) {
  const lines = jdText.split('\n');
  const sections = [];  // { text, weight }
  let current = { text: '', weight: 1.0 };
  
  for (const line of lines) {
    const match = SECTION_WEIGHTS.find(({ re }) => re.test(line));
    if (match) {
      if (current.text.trim()) sections.push(current);
      current = { text: '', weight: match.w };
    } else {
      current.text += ' ' + line;
    }
  }
  if (current.text.trim()) sections.push(current);
  return sections.filter(s => s.weight > 0);
}
```

### 1.3 Tech term whitelist + JD noise filter

**Design:**

```javascript
// Known tech terms — always high importance regardless of frequency
const TECH_TERMS = new Set([
  // Languages
  'typescript','javascript','python','golang','go','rust','java','kotlin',
  'swift','ruby','php','c++','cpp','scala','elixir','sql','r',
  // Frontend
  'react','angular','vue','svelte','next.js','nuxt','remix','solid',
  // Mobile
  'expo','react native','flutter','ios','android','swift ui',
  // Backend
  'node.js','express','fastapi','django','rails','spring','gin','fiber',
  'graphql','rest','grpc','websocket','trpc',
  // Databases
  'postgresql','mysql','mongodb','redis','elasticsearch','cassandra',
  'dynamodb','supabase','firebase','sqlite','planetscale','cockroachdb',
  // Cloud & Infra
  'aws','gcp','azure','vercel','netlify','docker','kubernetes','terraform',
  'ansible','github actions','gitlab ci','circle ci','heroku',
  // Tooling
  'webpack','vite','babel','esbuild','turbopack',
  // Testing
  'jest','vitest','cypress','playwright','testing library',
  // Collaboration
  'jira','asana','notion','linear','slack','figma','github','gitlab',
  // Practices
  'microservices','ci/cd','tdd','bdd','agile','scrum','devops',
  // AI/ML
  'openai','anthropic','llm','langchain','tensorflow','pytorch',
]);

// Words that appear in JDs but carry zero signal about candidate skills
const JD_NOISE = new Set([
  'passionate','excited','love','fun','thrive','culture','mission',
  'self-starter','fast-paced','startup','opportunity','competitive',
  'salary','benefits','unlimited','vacation','pto','insurance','equity',
  'stock','options','office','snacks','lunch','catered','retreat',
  'collaborative','motivated','driven','talented','world-class',
  'innovative','disrupting','revolutionize','change','impact',
  'seeking','looking','hiring','join','candidate','individual',
  'growing','scaling','series','funding','investors',
]);
```

### 1.4 Keyword classification output

Each keyword gets a category so the paraphrase engine knows where to inject it:

```javascript
const CATEGORIES = {
  language:    new Set(['typescript','javascript','python','golang','go','rust','java','kotlin','swift','ruby','php','sql','cpp','c++','scala','r']),
  framework:   new Set(['react','angular','vue','svelte','next.js','nuxt','expo','react native','flutter','express','fastapi','django','rails','spring','gin']),
  database:    new Set(['postgresql','mysql','mongodb','redis','elasticsearch','cassandra','dynamodb','supabase','firebase','sqlite']),
  cloud:       new Set(['aws','gcp','azure','vercel','netlify','docker','kubernetes','terraform','heroku','github actions']),
  api:         new Set(['graphql','rest','grpc','websocket','trpc','oauth','jwt']),
  tool:        new Set(['jira','asana','notion','linear','slack','figma','github','gitlab','webpack','vite','jest','cypress','playwright']),
  methodology: new Set(['microservices','ci/cd','tdd','bdd','agile','scrum','devops']),
};

function classifyKeyword(kw) {
  for (const [cat, terms] of Object.entries(CATEGORIES)) {
    if (terms.has(kw)) return cat;
  }
  if (TECH_TERMS.has(kw)) return 'tech';
  return 'general';
}
```

**Scoring output shape after Phase 1:**

```javascript
scoreResume(jdText, resumeText) → {
  score: number,                           // 0–100
  byCategory: {
    language:    { present: [], missing: [] },
    framework:   { present: [], missing: [] },
    database:    { present: [], missing: [] },
    cloud:       { present: [], missing: [] },
    tool:        { present: [], missing: [] },
    methodology: { present: [], missing: [] },
    general:     { present: [], missing: [] },
  },
  present: Keyword[],
  missing: Keyword[],
}
```

---

## Phase 2 — Intelligent Paraphrase Engine

**Goal:** Inject keywords that sound natural, are grammatically correct, and go into the right resume section.  
**Timeline:** 2–3 days

### 2.1 Resume section parser

**Problem:** Currently the engine uses fragile string matching (`result.includes("Programming Languages:")`) that fails for any non-Pragash resume.

**Design:**

```javascript
// Detect common section headers in any resume
const SECTION_PATTERNS = {
  summary:    /\b(summary|objective|about|profile|overview)\b/i,
  skills:     /\b(skills|technologies|tech.?stack|competencies|expertise)\b/i,
  experience: /\b(experience|employment|work.?history|career)\b/i,
  projects:   /\b(projects|portfolio|work|open.?source)\b/i,
  education:  /\b(education|academic|degree|university|college)\b/i,
};

function parseResumeSections(resumeText) {
  const lines = resumeText.split('\n');
  const sections = { summary: [], skills: [], experience: [], projects: [], education: [], other: [] };
  let current = 'other';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matched = Object.entries(SECTION_PATTERNS).find(([, re]) => re.test(line) && line.length < 60);
    if (matched) {
      current = matched[0];
      sections[current].push({ lineIdx: i, text: line, type: 'header' });
    } else {
      sections[current].push({ lineIdx: i, text: line, type: 'content' });
    }
  }
  
  return sections;
}
```

### 2.2 Category-aware injection routing

Each missing keyword goes to the section where it makes most sense:

```
Keyword category  → Target section       → Injection method
──────────────────────────────────────────────────────────
language          → skills (Languages:)  → Append to line, comma-separated
framework         → skills (Frameworks:) → Append to line
database          → skills (Databases:)  → Append to line
cloud             → skills (Tools:)      → Append to line
tool              → skills (Tools:)      → Append to line
methodology       → skills (Methods:)    → Append to line OR bullet with context
api               → relevant exp bullet  → Template-based bullet injection
general           → relevant exp bullet  → Only if confidence ≥ HIGH
```

**Rule: prefer skills section injection over bullet injection.** It's always grammatically safe to add a known keyword to a skills list. Bullet injection is reserved for tech keywords that are directly relevant to the bullet's work type.

### 2.3 Bullet injection templates

**Problem:** Current engine appends `, leveraging {kw}.` blindly. 

**Design — pattern matching + template selection:**

```javascript
// Detect the "work type" of a bullet
const BULLET_TYPE_PATTERNS = {
  build:    /\b(built|engineered|developed|architected|created|designed)\b/i,
  migrate:  /\b(migrated|upgraded|ported|refactored|converted)\b/i,
  optimise: /\b(optimised|improved|reduced|accelerated|enhanced)\b/i,
  led:      /\b(led|managed|mentored|coordinated|directed)\b/i,
  deploy:   /\b(deployed|shipped|released|launched|automated)\b/i,
  api:      /\b(api|endpoint|service|backend|microservice|rest)\b/i,
};

const INJECTION_TEMPLATES = {
  // For "built X" bullets → "built X with {kw}"
  build_language:    (b, kw) => b.replace(/\.$/, ` using ${kw}.`),
  build_framework:   (b, kw) => b.replace(/\.$/, ` in ${kw}.`),
  build_database:    null,    // don't inject databases into build bullets
  
  // For "improved X" bullets → "improving X via {kw}"
  optimise_tool:     (b, kw) => b.replace(/\.$/, ` via ${kw}.`),
  optimise_methodology: (b, kw) => b.replace(/\.$/, `, adopting ${kw} practices.`),
  
  // For "deployed X" bullets
  deploy_cloud:      (b, kw) => b.replace(/\.$/, ` on ${kw}.`),
  deploy_tool:       (b, kw) => b.replace(/\.$/, ` using ${kw}.`),
  
  // Generic fallback — only if nothing else matches
  fallback:          (b, kw) => b.replace(/\.$/, `, integrating ${kw}.`),
};

function chooseBestTemplate(bullet, kwCategory) {
  const bulletType = Object.entries(BULLET_TYPE_PATTERNS)
    .find(([, re]) => re.test(bullet))?.[0] || 'generic';
  return INJECTION_TEMPLATES[`${bulletType}_${kwCategory}`] || INJECTION_TEMPLATES.fallback;
}
```

### 2.4 Injection confidence scoring

**Problem:** Currently injects any keyword that has a context hint match — too aggressive.

**New rule — only inject if ALL of:**
1. Keyword appears ≥ 2× in the JD (weak signal if only once)
2. Keyword category is `language`, `framework`, `api`, or `cloud` (not tools — they go to skills section)
3. The bullet's work type has a non-null template for this category
4. The keyword has NOT already been injected in a previous bullet

```javascript
function shouldInjectIntoBullet(kw, freq, category, bulletType) {
  if (freq < 2) return false;                            // weak JD signal
  if (['tool', 'database'].includes(category)) return false; // → skills section only
  if (!INJECTION_TEMPLATES[`${bulletType}_${category}`]) return false; // no template
  return true;
}
```

### 2.5 Generic summary reframe (replacing hardcoded Pragash strings)

**Problem:** Summary reframe only works for Pragash's exact text.

**New design — detect-and-replace weak patterns generically:**

```javascript
// Detect if summary sounds like a specialist rather than full-stack
const SPECIALIST_PATTERNS = [
  { re: /focused on frontend/i,          replace: 'building full-stack' },
  { re: /frontend (developer|engineer)/i, replace: 'full-stack $1' },
  { re: /backend (developer|engineer)/i,  replace: 'full-stack $1' },
  { re: /angular (developer|engineer)/i,  replace: 'full-stack $1' },
  { re: /react (developer|engineer)/i,    replace: 'full-stack $1' },
];

// Add target role's primary tech to summary if not mentioned
function enhanceSummary(summaryLine, jdKeywords) {
  let result = summaryLine;
  
  // Apply specialist → generalist patterns
  for (const { re, replace } of SPECIALIST_PATTERNS) {
    result = result.replace(re, replace);
  }
  
  // If JD has TypeScript and summary doesn't → add to tech list in summary
  const jdTopTech = jdKeywords.filter(k => k.category === 'language').slice(0, 3).map(k => k.keyword);
  const missingInSummary = jdTopTech.filter(t => !result.toLowerCase().includes(t));
  
  if (missingInSummary.length > 0 && result.includes('Expert in ')) {
    result = result.replace('Expert in ', `Expert in ${missingInSummary.join(', ')}, `);
  }
  
  return result;
}
```

---

## Phase 3 — Scraping Improvements

**Timeline:** 1 day

### 3.1 Two-proxy fallback

```javascript
const PROXIES = [
  url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function scrapeURL(url, timeout = 10000) {
  for (const makeProxy of PROXIES) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const resp = await fetch(makeProxy(url), { signal: ctrl.signal });
      clearTimeout(timer);
      if (!resp.ok) continue;
      const data = await resp.json();
      const contents = data.contents || data.body || '';
      if (contents.length < 200) continue;   // proxy returned empty page
      return extractJobText(contents);
    } catch {
      clearTimeout(timer);
      // try next proxy
    }
  }
  throw new Error('All proxies failed — please paste the JD text directly.');
}
```

### 3.2 Smarter job board selectors

Based on test results, priority selector order:

```javascript
const SELECTORS = [
  // Direct ATS systems (most reliable)
  '[class*="job-post-description"]',       // Greenhouse
  '[class*="posting-body"]',               // Lever
  '#jobDescriptionText',                    // Indeed
  '[data-automation-id="job-posting-details"]', // Workday
  '[class*="ashby-job-posting"]',          // Ashby
  '[class*="BambooHR-ATS"]',               // BambooHR
  // Generic fallbacks
  '[class*="job-description"]',
  '[class*="jobDescription"]',
  '[id*="job"]',
  'article',
  'main',
];
```

### 3.3 Post-extraction cleanup

After getting raw text, remove remaining noise:

```javascript
function cleanJDText(text) {
  // Remove salary / compensation paragraphs
  text = text.replace(/\$[\d,]+[k\-–—\/][\s\S]{0,200}(per year|annually|salary)/gi, '');
  // Remove "Apply now" / "Submit" boilerplate
  text = text.replace(/(apply now|submit your application|click to apply)[\s\S]{0,100}/gi, '');
  // Remove duplicate whitespace
  return text.replace(/\s+/g, ' ').trim().slice(0, 8000);
}
```

### 3.4 Job board compatibility matrix (from tests)

| Board | Proxy Works | Selector Reliable | Notes |
|-------|------------|-------------------|-------|
| Greenhouse | ✓ | ✓ | Best-case scenario |
| Lever | ✓ | ✓ | Minimal JS required |
| Indeed | ✓ | ✓ | Rate-limits after 5 req/min |
| Ashby | ✓ | ✓ | Clean HTML |
| BambooHR | ✓ | ✓ | Clean HTML |
| Company site | ✓ | ⚠ | Varies by site |
| LinkedIn | ✗ | N/A | Auth wall — paste required |
| Workday | ⚠ | ⚠ | JS-rendered — partial text only |
| Glassdoor | ✗ | N/A | Blocked by proxy |

---

## Phase 4 — Architecture Modularisation

**Timeline:** 3–5 days  
**Goal:** Break the 860-line monolith into testable modules.

### Target file structure

```
src/
├── lib/
│   ├── tokenizer.js        # tokenizeSentences(), extractKeywords(), normalise()
│   ├── scorer.js           # scoreResume(), classifyKeyword()
│   ├── adapter.js          # adaptResume(), section-aware routing
│   ├── section-parser.js   # parseResumeSections(), parseJDSections()
│   └── scraper.js          # scrapeURL(), two-proxy fallback, cleanJDText()
│
├── constants/
│   ├── tech-terms.js       # TECH_TERMS, CATEGORIES, JD_NOISE, NORMALISE
│   ├── verb-map.js         # VERB_MAP (action verb upgrades)
│   └── injection-templates.js  # INJECTION_TEMPLATES, BULLET_TYPE_PATTERNS
│
├── components/
│   ├── ScoreRing.jsx
│   ├── ChangeBadge.jsx
│   ├── KeywordCloud.jsx
│   ├── StepNav.jsx
│   └── ResumeEditor.jsx
│
├── hooks/
│   ├── useATS.js           # state + actions (replaces App's 12 useState calls)
│   └── useStorage.js       # session persistence via window.storage
│
├── export/
│   └── toGDocs.js          # sendPrompt() wrapper
│
└── App.jsx                 # thin orchestrator only
```

### Test suite plan

```
tests/
├── tokenizer.test.js   # tokenizeSentences, bigram boundary tests
├── scorer.test.js      # scoreResume golden-set tests
├── adapter.test.js     # adaptResume injection + verb upgrade tests
├── scraper.test.js     # HTML extraction from job board fixtures
└── fixtures/
    ├── greenhouse.html
    ├── lever.html
    ├── indeed.html
    └── sample-resume.txt
```

---

## Priority Order for Implementation

```
P0 (critical bugs blocking basic function)
  ├── Fix tokenizer sentence-boundary bigrams
  ├── Fix tech term recognition (normalisation)
  ├── Remove 'go' from CONTEXT_HINTS
  └── Remove Pragash-specific summary hardcoding

P1 (intelligence that makes the tool actually useful)
  ├── JD section weighting (Requirements 2×, Benefits 0×)
  ├── JD noise filter (NOISE_WORDS set)
  ├── Keyword classification (language / framework / tool / etc.)
  └── Category-aware injection routing

P2 (quality of output)
  ├── Injection confidence gating
  ├── Bullet type detection + template selection
  ├── Generic summary reframe
  └── Two-proxy fallback for scraping

P3 (robustness + DX)
  ├── Modular file structure
  ├── Unit tests
  └── Session persistence
```

---

## What "Intelligence" Means in This System

This system uses **no AI** for the core pipeline. "Intelligence" here means:

1. **Domain knowledge embedded as data** — a curated list of 200+ known tech terms is far more accurate than frequency analysis alone for identifying relevant JD keywords.

2. **Structural awareness** — detecting JD sections (Requirements vs. Benefits) and resume sections (Skills vs. Experience) allows the engine to route keyword injection correctly rather than blindly appending text.

3. **Pattern library** — a set of typed injection templates (build + language = "using X", deploy + cloud = "on X") produces grammatically natural output vs. the current `, leveraging X.` approach.

4. **Confidence gating** — injecting only when a keyword appears 2+ times in the JD and has a matching template for the bullet's work type reduces false positives.

The result is a deterministic, auditable, fast pipeline where every output change can be traced to a named rule.
