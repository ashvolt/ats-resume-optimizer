// ats-resume-builder.jsx  —  v0.2
// Fixes applied: Bug-1 through Bug-12
// Intelligence: sentence-aware tokenizer, JD section weighting, tech-term
//               whitelist, noise filter, category-aware injection, typed templates
import { useState } from "react";
import { extractProxyContents, extractReadableJDText } from "./src/scraper.js";

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const SW = new Set(
  ("a an the and or but in on at to for of with by from as is was are were be " +
  "been being have has had do does did will would could should may might shall " +
  "can this that these those it its i we you he she they them their our your my " +
  "his her what which who how when where why all each every both few more most " +
  "other some such no not only same so than too very just about above after " +
  "before between during through under until up upon while also into over then " +
  "there here use using used year work working experience team teams company " +
  "build building help make making across within including ensure strong ability " +
  "responsible requirements preferred nice good plus bonus required must like " +
  "new one two three four five six seven eight nine ten need needs provide " +
  "support based way get gets getting take takes taking per day week month etc").split(" ")
);

// Known JD boilerplate — carries zero signal about candidate skills
const JD_NOISE = new Set(
  ("passionate excited love fun thrive culture mission self-starter fast-paced " +
  "startup opportunity competitive salary benefits unlimited vacation pto " +
  "insurance equity stock options office snacks lunch catered retreat " +
  "collaborative motivated driven talented world-class innovative disrupting " +
  "revolutionize impact seeking looking hiring join candidate individual " +
  "growing scaling funding investors environment ideal").split(" ")
);

// Verified tech terms — always extracted regardless of frequency
const TECH_TERMS = new Set(
  ("typescript javascript python golang go rust java kotlin swift ruby php sql " +
  "cpp scala elixir react angular vue svelte remix solid nextjs nuxt expo " +
  "flutter ios android express fastapi django rails spring gin fiber graphql " +
  "rest grpc websocket trpc oauth jwt postgresql mysql mongodb redis " +
  "elasticsearch cassandra dynamodb supabase firebase sqlite aws gcp azure " +
  "vercel netlify docker kubernetes terraform ansible webpack vite jest cypress " +
  "playwright vitest jira asana notion linear slack figma github gitlab " +
  "microservices cicd tdd bdd agile scrum devops openai llm langchain signalr " +
  "ocelot node nodejs react-native").split(" ")
);

// Keyword categories — used to route injection to the right resume section
const KW_CATEGORIES = {
  language:    new Set("typescript javascript python golang go rust java kotlin swift ruby php sql cpp scala r".split(" ")),
  framework:   new Set("react angular vue svelte nextjs nuxt remix solid expo flutter express fastapi django rails spring gin fiber".split(" ")),
  database:    new Set("postgresql mysql mongodb redis elasticsearch cassandra dynamodb supabase firebase sqlite".split(" ")),
  cloud:       new Set("aws gcp azure vercel netlify docker kubernetes terraform heroku".split(" ")),
  api:         new Set("graphql rest grpc websocket trpc oauth jwt".split(" ")),
  tool:        new Set("jira asana notion linear slack figma github gitlab jest cypress playwright vitest".split(" ")),
  methodology: new Set("microservices cicd tdd bdd agile scrum devops".split(" ")),
};

// Normalise alternate spellings → canonical form
const NORMALISE = {
  nodejs: "node.js", nextjs: "next.js", nuxtjs: "nuxt.js", reactjs: "react",
  vuejs: "vue", cpp: "c++", k8s: "kubernetes", postgres: "postgresql",
  psql: "postgresql", ts: "typescript", js: "javascript",
};

// Action verb upgrades for bullet points
const VERB_MAP = {
  built: "engineered", created: "architected", made: "developed",
  helped: "contributed to", used: "leveraged", did: "executed",
  wrote: "authored", fixed: "resolved", changed: "optimized",
  added: "implemented", "set up": "established", handled: "managed",
  ran: "spearheaded", showed: "demonstrated", "worked on": "delivered",
};

// JD section weight multipliers
const SECTION_WEIGHTS = [
  { re: /\b(requirements?|must.have|qualifications?|you.will.need|what we.re looking)\b/i, w: 2.0 },
  { re: /\b(what you.ll do|responsibilities|you will|what you will)\b/i,                  w: 1.5 },
  { re: /\b(nice.to.have|preferred|bonus|good.to.have|great.to.have)\b/i,                 w: 0.5 },
  { re: /\b(about.us|why.join|benefits|perks|what.we.offer|compensation|salary|pto|insurance|equity|culture|life.at)\b/i, w: 0 },
];

// Bullet work-type detection
const BULLET_TYPES = {
  build:    /\b(built|engineered|developed|architected|created|designed|launched)\b/i,
  migrate:  /\b(migrated|upgraded|ported|refactored|converted|replaced)\b/i,
  optimise: /\b(optimised?|improved|reduced|accelerated|enhanced|boosted)\b/i,
  deploy:   /\b(deployed|shipped|released|automated|containerised?)\b/i,
  api:      /\b(api|endpoint|service|backend|microservice|rest|graphql)\b/i,
  test:     /\b(test|qa|quality|coverage|defect|playwright|cypress|jest)\b/i,
  lead:     /\b(led|managed|mentored|coordinated|directed|spearheaded)\b/i,
};

// Typed injection templates: [bulletType]_[kwCategory] → fn(bullet, kw)
const TEMPLATES = {
  build_language:    (b, kw) => b.replace(/\.$/, ` using ${kw}.`),
  build_framework:   (b, kw) => b.replace(/\.$/, ` in ${kw}.`),
  build_api:         (b, kw) => b.replace(/\.$/, ` with ${kw} endpoints.`),
  build_cloud:       (b, kw) => b.replace(/\.$/, ` deployed on ${kw}.`),
  deploy_cloud:      (b, kw) => b.replace(/\.$/, ` on ${kw}.`),
  deploy_tool:       (b, kw) => b.replace(/\.$/, ` via ${kw}.`),
  optimise_tool:     (b, kw) => b.replace(/\.$/, `, measured via ${kw}.`),
  optimise_methodology: (b, kw) => b.replace(/\.$/, `, following ${kw} practices.`),
  api_framework:     (b, kw) => b.replace(/\.$/, ` with ${kw}.`),
  api_language:      (b, kw) => b.replace(/\.$/, ` in ${kw}.`),
  migrate_language:  (b, kw) => b.replace(/\.$/, ` to ${kw}.`),
  migrate_framework: (b, kw) => b.replace(/\.$/, ` to ${kw}.`),
};

// ═══════════════════════════════════════════════════════════════════════════════
//  TOKENIZER — sentence-aware (fixes Bug-3 bigram crossing, Bug-1 punctuation)
// ═══════════════════════════════════════════════════════════════════════════════
function normToken(t) {
  // Normalise: nodejs → node.js, etc.
  const n = t.replace(/[^a-z0-9\.\+\#\/\-]/g, "").toLowerCase();
  return NORMALISE[n] || n;
}

function tokenizeSentences(text) {
  // Split into sentences FIRST — bigrams will never cross sentence boundaries
  return text
    .replace(/([.;:!?\n])\s*/g, "$1\n")
    .split("\n")
    .filter(s => s.trim().length > 2)
    .map(sentence =>
      sentence
        .toLowerCase()
        .replace(/\b(\w+)\.js\b/g, "$1js")   // node.js → nodejs (then NORMALISE back)
        .replace(/\bc\+\+/g, "cpp")
        .replace(/[^a-z0-9\s\.\+\#\/\-]/g, " ")
        .split(/\s+/)
        .map(normToken)
        .filter(t => t.length > 1 && !SW.has(t))
    );
}

function extractKeywords(text) {
  const sentences = tokenizeSentences(text);
  const freq = {};
  for (const tokens of sentences) {
    tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    for (let i = 0; i < tokens.length - 1; i++) {
      const bg = `${tokens[i]} ${tokens[i + 1]}`;
      freq[bg] = (freq[bg] || 0) + 1.5;
    }
  }
  return freq;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  JD SECTION PARSER — weights Requirements 2×, skips Benefits 0×
// ═══════════════════════════════════════════════════════════════════════════════
function parseJDSections(jdText) {
  const lines = jdText.split("\n");
  const sections = [];
  let current = { text: "", weight: 1.0 };
  for (const line of lines) {
    const match = SECTION_WEIGHTS.find(({ re }) => re.test(line));
    if (match && line.trim().length < 80) {
      if (current.text.trim()) sections.push(current);
      current = { text: "", weight: match.w };
    } else {
      current.text += " " + line;
    }
  }
  if (current.text.trim()) sections.push(current);
  return sections.filter(s => s.weight > 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  KEYWORD CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════
function classifyKeyword(kw) {
  const base = kw.split(" ")[0]; // first word of bigrams
  for (const [cat, terms] of Object.entries(KW_CATEGORIES)) {
    if (terms.has(kw) || terms.has(base)) return cat;
  }
  return TECH_TERMS.has(kw) || TECH_TERMS.has(base) ? "tech" : "general";
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ATS SCORER — section-weighted, noise-filtered, tech-term aware
// ═══════════════════════════════════════════════════════════════════════════════
function scoreResume(jdText, resumeText) {
  const sections = parseJDSections(jdText);
  const weightedFreq = {};

  for (const { text, weight } of sections) {
    const kws = extractKeywords(text);
    for (const [kw, freq] of Object.entries(kws)) {
      // Filter: skip noise words and pure-number tokens
      if (JD_NOISE.has(kw) || JD_NOISE.has(kw.split(" ")[0])) continue;
      if (/^\d+$/.test(kw)) continue;
      if (kw.length < 2) continue;
      // Single non-tech words need 2+ occurrences to count
      if (!kw.includes(" ") && !TECH_TERMS.has(kw) && freq < 2) continue;
      weightedFreq[kw] = (weightedFreq[kw] || 0) + freq * weight;
    }
  }

  const resumeLower = resumeText.toLowerCase();
  const ranked = Object.entries(weightedFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([keyword, freq]) => ({
      keyword,
      freq: Math.round(freq * 10) / 10,
      present: resumeLower.includes(keyword),
      category: classifyKeyword(keyword),
    }));

  const total   = ranked.reduce((s, k) => s + k.freq, 0);
  const matched = ranked.filter(k => k.present).reduce((s, k) => s + k.freq, 0);

  return {
    score:   total > 0 ? Math.round((matched / total) * 100) : 0, // Bug-12 fix: no cap
    present: ranked.filter(k => k.present),
    missing: ranked.filter(k => !k.present),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RESUME SECTION PARSER
// ═══════════════════════════════════════════════════════════════════════════════
const RESUME_SECTIONS = {
  summary:    /\b(summary|objective|about|profile|overview)\b/i,
  skills:     /\b(skills|technologies|tech.?stack|competencies|expertise|technical)\b/i,
  experience: /\b(experience|employment|work.?history|career|consultant|engineer)\b/i,
  projects:   /\b(projects?|portfolio|open.?source)\b/i,
  education:  /\b(education|academic|degree|university|college)\b/i,
};

function detectSection(line) {
  if (line.trim().length > 70) return null; // too long to be a header
  for (const [sec, re] of Object.entries(RESUME_SECTIONS)) {
    if (re.test(line)) return sec;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PARAPHRASE ENGINE — intelligent, generic, no hardcoded user strings
// ═══════════════════════════════════════════════════════════════════════════════

function upgradeVerb(line) {
  for (const [weak, strong] of Object.entries(VERB_MAP)) {
    const re = new RegExp(`(^[●•\\-\\*\\s]+)(${weak})\\b`, "i");
    if (re.test(line)) return line.replace(re, (_, p) => p + strong);
  }
  return line;
}

function detectBulletType(bullet) {
  for (const [type, re] of Object.entries(BULLET_TYPES)) {
    if (re.test(bullet)) return type;
  }
  return "generic";
}

// Generic specialist → full-stack reframe patterns (Bug-5 fix)
const SPECIALIST_PATTERNS = [
  [/\bfocused on frontend\b/i,                     "building full-stack platforms"],
  [/\bfrontend (developer|engineer|spa|spe)/i,      "full-stack $1"],
  [/\bangular\s+(developer|engineer|specialist)/i,  "full-stack $1"],
  [/\breact\s+(developer|engineer|specialist)/i,    "full-stack $1"],
  [/\b(senior|lead)?\s*ui\/?ux (developer|engineer)/i, "full-stack $2"],
];

function reframeSummary(line) {
  let result = line;
  for (const [re, replacement] of SPECIALIST_PATTERNS) {
    result = result.replace(re, replacement);
  }
  return result;
}

// Find the right skills-section line for a given keyword category
function getSkillsLinePattern(category) {
  const MAP = {
    language:    /programming languages?:/i,
    framework:   /frameworks?:/i,
    database:    /databases?:/i,
    cloud:       /tools?:|cloud:/i,
    tool:        /tools?:/i,
    methodology: /methodolog|practices?:/i,
    api:         /frameworks?:|backend:/i,
  };
  return MAP[category] || /tools?:/i;
}

function adaptResume(resumeText, missingKws) {
  const lines = resumeText.split("\n");
  const changes = [];
  const injected = new Set();
  const topMissing = missingKws.slice(0, 16);

  // Split missing keywords by category
  const byCategory = {};
  for (const kw of topMissing) {
    const cat = classifyKeyword(kw.keyword);
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(kw);
  }

  // Track current resume section
  let currentSection = "other";
  let summaryNextLine = false;

  const adapted = lines.map((line, idx) => {
    let result = line;
    const section = detectSection(line);
    if (section) { currentSection = section; summaryNextLine = (section === "summary"); return result; }

    // ── 1. Generic summary reframe (Bug-5 fix: no hardcoded strings) ──────────
    if (summaryNextLine && line.trim().length > 20) {
      summaryNextLine = false;
      const reframed = reframeSummary(result);
      if (reframed !== result) {
        changes.push({ type: "summary", before: line.trim(), after: reframed.trim() });
        result = reframed;
      }
    }

    // ── 2. Skills section — category-aware injection ───────────────────────────
    if (currentSection === "skills") {
      for (const [cat, kws] of Object.entries(byCategory)) {
        const pat = getSkillsLinePattern(cat);
        if (pat.test(result)) {
          const toAdd = kws
            .filter(k => !result.toLowerCase().includes(k.keyword))
            .slice(0, 2)
            .map(k => k.keyword.charAt(0).toUpperCase() + k.keyword.slice(1));
          if (toAdd.length > 0) {
            // Remove 'Gmail' (non-technical) from Tools while we're here
            const cleaned = result.trimEnd().replace(/,?\s*Gmail\b/i, "");
            result = cleaned + `, ${toAdd.join(", ")}`;
            toAdd.forEach(k => injected.add(k.toLowerCase()));
            changes.push({ type: "skill", before: line.trim(), after: result.trim() });
          }
        }
      }
    }

    // ── 3. Verb upgrades in bullets ────────────────────────────────────────────
    if (/^\s*[●•\-\*]/.test(line) && line.trim().length > 20) {
      const upgraded = upgradeVerb(result);
      if (upgraded !== result) {
        changes.push({ type: "verb", before: result.trim(), after: upgraded.trim() });
        result = upgraded;
      }
    }

    // ── 4. Typed keyword injection into bullets ────────────────────────────────
    if (/^\s*[●•\-\*]/.test(line) && result.trim().length > 45) {
      const ll = result.toLowerCase();
      const bulletType = detectBulletType(ll);

      for (const kw of topMissing) {
        const k = kw.keyword;
        if (injected.has(k) || ll.includes(k)) { injected.add(k); continue; }

        const cat = classifyKeyword(k);

        // Only inject languages, frameworks, cloud, and api keywords into bullets
        // (Bug-6 partial fix: databases + tools go to skills section only)
        if (["database", "tool", "general"].includes(cat)) continue;

        // Only inject if JD mentions it 2+ times (confidence gate)
        if (kw.freq < 2) continue;

        // Pick the best template
        const templateKey = `${bulletType}_${cat}`;
        const fn = TEMPLATES[templateKey];
        if (!fn) continue; // no template for this combo — skip

        const inj = fn(result, k);
        if (inj !== result) {
          changes.push({ type: "inject", before: result.trim(), after: inj.trim() });
          result = inj;
          injected.add(k);
          break; // one injection per bullet
        }
      }
    }

    // ── 5. "Technologies Used:" lines — safe tech-stack append ────────────────
    if (/technologies used:/i.test(result)) {
      const techToAdd = topMissing
        .filter(k => !result.toLowerCase().includes(k.keyword) &&
          !injected.has(k.keyword) &&
          ["language", "framework", "database", "cloud", "api"].includes(classifyKeyword(k.keyword)) &&
          k.freq >= 2)
        .slice(0, 2)
        .map(k => k.keyword.charAt(0).toUpperCase() + k.keyword.slice(1));
      if (techToAdd.length > 0) {
        result = result.trimEnd() + `, ${techToAdd.join(", ")}`;
        techToAdd.forEach(k => injected.add(k.toLowerCase()));
        changes.push({ type: "tech", before: line.trim(), after: result.trim() });
      }
    }

    return result;
  });

  return { text: adapted.join("\n"), changes };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  URL SCRAPER — timeout + two-proxy fallback (Bug-7, Bug-8 fixes)
// ═══════════════════════════════════════════════════════════════════════════════
const PROXIES = [
  url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  url => `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

// Priority selectors for major job boards
const JD_SELECTORS = [
  '[class*="job-post-description"]',       // Greenhouse
  '[class*="posting-body"]',               // Lever
  '#jobDescriptionText',                    // Indeed
  '[data-automation-id="job-posting-details"]', // Workday
  '[class*="ashby-job-posting"]',          // Ashby
  '[class*="BambooHR-ATS"]',               // BambooHR
  '[class*="job-description"]',
  '[class*="jobDescription"]',
  '[id*="description"]',
  "article",
  "main",
];

async function scrapeURL(url, timeout = 10000) {
  let lastError = "";
  for (const makeProxy of PROXIES) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const resp = await fetch(makeProxy(url), { signal: ctrl.signal });
      clearTimeout(timer);
      if (!resp.ok) { lastError = `HTTP ${resp.status}`; continue; }

      const text = await resp.text();
      const contents = extractProxyContents(text, resp.headers.get("content-type") || "");
      if (!contents || contents.length < 200) { lastError = "Empty response"; continue; }

      const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(contents);
      if (looksLikeHtml) {
        const doc = new DOMParser().parseFromString(contents, "text/html");
        ["script", "style", "nav", "footer", "header", "aside", "form"].forEach(t =>
          doc.querySelectorAll(t).forEach(el => el.remove())
        );

        for (const sel of JD_SELECTORS) {
          const el = doc.querySelector(sel);
          if (el?.textContent?.trim().length > 300) {
            return cleanJDText(el.textContent);
          }
        }

        const bodyText = doc.body?.textContent || "";
        if (bodyText.trim().length > 200) return cleanJDText(bodyText);
      }

      const readableText = extractReadableJDText(contents);
      if (readableText.length > 200) return cleanJDText(readableText);

      lastError = "No job content found in page";
    } catch (e) {
      clearTimeout(timer);
      lastError = e.name === "AbortError" ? "Timed out after 10s" : e.message;
    }
  }
  throw new Error(`All proxies failed (${lastError}). Paste the JD text directly.`);
}

function cleanJDText(raw) {
  return raw
    .replace(/\$[\d,]+[k\s\-–—\/][\s\S]{0,200}?(per year|annually|\/yr)/gi, "")
    .replace(/(apply now|submit your application|click to apply)[\s\S]{0,100}/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RECRUITER EMAIL — extraction + auto-draft
// ═══════════════════════════════════════════════════════════════════════════════
function extractRecruiterEmail(jdText) {
  if (!jdText) return "";
  const matches = jdText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (!matches || matches.length === 0) return "";
  const preferred = matches.find(m => /recruit|talent|hr|careers|jobs|hiring|people/i.test(m));
  return preferred || matches[0];
}

function extractJobTitle(jdText) {
  if (!jdText) return "this position";
  const lines = jdText.split("\n").map(l => l.trim()).filter(Boolean);
  const first = lines[0] || "";
  if (first.length > 3 && first.length < 80) return first;
  return "this position";
}

function buildEmailDraft(jdText, resumeText) {
  const title = extractJobTitle(jdText);
  const nameMatch = resumeText.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})/m);
  const name = nameMatch ? nameMatch[1] : "";
  const subject = `Application for ${title}`;
  const body =
    `Dear Hiring Team,\n\n` +
    `I'm writing to apply for the ${title} role. I've tailored my resume to the requirements in your ` +
    `job posting and would welcome the chance to discuss how my background fits your needs.\n\n` +
    `Thank you for your time and consideration.\n\n` +
    `Best regards,\n${name || "[Your name]"}`;
  return { subject, body };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCORE RING COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function ScoreRing({ score, label, size = 96 }) {
  const r = 36, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#1D9E75" : score >= 55 ? "#BA7517" : "#E24B4A";
  return (
    <div style={{ textAlign: "center", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 96 96" aria-label={`ATS score ${score} out of 100`}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--color-border-tertiary)" strokeWidth="7" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 48 48)"
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)" }}
        />
        <text x="48" y="44" textAnchor="middle" fontSize="19" fontWeight="500" fill={color}>{score}</text>
        <text x="48" y="59" textAnchor="middle" fontSize="10" fill="var(--color-text-secondary)">/100</text>
      </svg>
      {label && <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{label}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHANGE BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const BADGE_STYLES = {
  verb:    { bg: "#E6F1FB", txt: "#185FA5", label: "verb upgrade" },
  inject:  { bg: "#E1F5EE", txt: "#0F6E56", label: "keyword injected" },
  skill:   { bg: "#EEEDFE", txt: "#3C3489", label: "skill added" },
  tool:    { bg: "#FAEEDA", txt: "#854F0B", label: "tool added" },
  tech:    { bg: "#FAEEDA", txt: "#854F0B", label: "tech stack" },
  summary: { bg: "#FAECE7", txt: "#993C1D", label: "summary" },
};
function ChangeBadge({ type }) {
  const s = BADGE_STYLES[type] || BADGE_STYLES.inject;
  return (
    <span style={{ display: "inline-block", fontSize: 10, padding: "2px 8px",
      borderRadius: 20, fontWeight: 500, background: s.bg, color: s.txt, marginBottom: 4 }}>
      {s.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CATEGORY MINI-SCORE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function CategoryScores({ present, missing }) {
  const cats = ["language", "framework", "database", "cloud", "tool", "methodology", "api"];
  const catLabels = { language:"Languages", framework:"Frameworks", database:"Databases",
                      cloud:"Cloud/Infra", tool:"Tools", methodology:"Methods", api:"APIs" };
  const rows = cats.map(cat => {
    const p = present.filter(k => k.category === cat).length;
    const m = missing.filter(k => k.category === cat).length;
    if (p + m === 0) return null;
    return { cat, p, m, pct: Math.round((p / (p + m)) * 100) };
  }).filter(Boolean);
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: "1rem" }}>
      {rows.map(({ cat, p, m, pct }) => (
        <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0",
          borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ width: 90, fontSize: 12, color: "var(--color-text-secondary)" }}>{catLabels[cat]}</div>
          <div style={{ flex: 1, height: 5, background: "var(--color-border-tertiary)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct >= 80 ? "#1D9E75" : pct >= 50 ? "#BA7517" : "#E24B4A", borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", width: 40, textAlign: "right" }}>{p}/{p+m}</div>
          {m > 0 && <div style={{ fontSize: 10, color: "#993C1D", width: 70, textAlign: "right" }}>
            {missing.filter(k => k.category === cat).slice(0, 2).map(k => k.keyword).join(", ")}
          </div>}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP  (Bug-2 fix: useCallback removed from import)
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [step, setStep]           = useState(0);
  const [jdText, setJdText]       = useState("");
  const [jdUrl, setJdUrl]         = useState("");
  const [resumeText, setResumeText] = useState("");
  const [atsResult, setAtsResult] = useState(null);
  const [adapted, setAdapted]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [gdocsUrl, setGdocsUrl]   = useState("");
  const [copied, setCopied]       = useState(false);
  const [showAll, setShowAll]     = useState(false);
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [emailDetected, setEmailDetected]   = useState(false);
  const [emailSubject, setEmailSubject]     = useState("");
  const [emailBody, setEmailBody]           = useState("");
  const [emailSent, setEmailSent]           = useState(false);

  const fetchJD = async () => {
    if (!jdUrl.trim()) return;
    setLoading(true); setError("");
    try {
      const text = await scrapeURL(jdUrl.trim());
      setJdText(text);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const analyze = () => {
    if (!jdText.trim() || !resumeText.trim()) {
      setError("Please provide both the job description and your resume.");
      return;
    }
    setError("");
    // Invalidate previous results (Bug-11 fix)
    setAtsResult(scoreResume(jdText, resumeText));
    setAdapted(null);
    setStep(1);

    // Auto-detect recruiter email + draft application email for this JD
    const detected = extractRecruiterEmail(jdText);
    setEmailDetected(!!detected);
    setRecruiterEmail(detected);
    const draft = buildEmailDraft(jdText, resumeText);
    setEmailSubject(draft.subject);
    setEmailBody(draft.body);
    setEmailSent(false);
  };

  // Bug-11 fix: invalidate results when inputs change
  const handleJdChange = (val) => { setJdText(val); setAtsResult(null); setAdapted(null); };
  const handleResumeChange = (val) => { setResumeText(val); setAtsResult(null); setAdapted(null); };

  const runAdaptation = () => {
    if (!atsResult) return;
    const result = adaptResume(resumeText, atsResult.missing);
    const newAts = scoreResume(jdText, result.text);
    setAdapted({ ...result, newScore: newAts.score });
    setStep(2);
  };

  const copyText = () => {
    navigator.clipboard.writeText(adapted?.text || resumeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const pushToGDocs = () => {
    const content = adapted?.text || resumeText;
    const docRef = gdocsUrl.trim()
      ? `Google Doc URL: ${gdocsUrl.trim()}`
      : `Please search Google Drive for my resume (filename contains "resume" or "cv").`;
    window.sendPrompt(
      `Update my Google Docs resume via Google Drive MCP.\n\n${docRef}\n\n` +
      `Steps:\n1. Open the Google Doc\n2. Replace the body with the adapted resume below, ` +
      `preserving heading styles and bullet formatting\n3. Confirm once done\n\n` +
      `─────────────────────\nADAPTED RESUME:\n─────────────────────\n${content}`
    );
  };

  const sendRecruiterEmail = () => {
    if (!recruiterEmail.trim()) {
      setError("Enter the recruiter's email before sending.");
      return;
    }
    const content = adapted?.text || resumeText;
    window.sendPrompt(
      `Send an application email via Gmail MCP.\n\n` +
      `To: ${recruiterEmail.trim()}\n` +
      `Subject: ${emailSubject}\n\n` +
      `Body:\n${emailBody}\n\n` +
      `Steps:\n1. Authenticate Gmail MCP if needed\n2. Send the email above to the recipient, ` +
      `including the adapted resume text below the signature\n3. Confirm once sent\n\n` +
      `─────────────────────\nRESUME TEXT TO INCLUDE:\n─────────────────────\n${content}`
    );
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 2500);
  };

  // ── Shared styles ─────────────────────────────────────────────────────────
  const card = { background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem", marginBottom: "1rem" };

  const btn = (v = "default") => ({
    padding: "8px 20px", fontSize: 13, fontWeight: 500, border: "0.5px solid",
    borderRadius: "var(--border-radius-md)", cursor: "pointer", transition: "opacity .15s",
    ...(v === "primary"  ? { background: "var(--color-text-primary)", color: "var(--color-background-primary)", borderColor: "var(--color-text-primary)" }
      : v === "success"  ? { background: "#1D9E75", color: "#fff", borderColor: "#1D9E75" }
      : v === "info"     ? { background: "var(--color-background-info)", color: "var(--color-text-info)", borderColor: "var(--color-border-info)" }
      : { background: "transparent", color: "var(--color-text-primary)", borderColor: "var(--color-border-secondary)" }),
  });

  const STEPS = ["Setup", "ATS Analysis", "Adapt", "Export"];

  return (
    <div style={{ fontFamily: "var(--font-sans)", maxWidth: 700, margin: "0 auto", padding: "1rem 0 2rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>
          ATS Resume Optimizer
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>
          Paste a JD or scrape a URL · get your ATS score · adapt with the paraphrase engine · push to Google Docs
        </p>
      </div>

      {/* Step nav — Bug-11 fix: proper canNavigate logic */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "1.5rem" }}>
        {STEPS.map((s, i) => {
          const canNav = i === 0 || (i === 1 && atsResult) || (i === 2 && adapted) || (i === 3 && adapted);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => canNav && setStep(i)} style={{
                display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                background: "none", border: "none", cursor: canNav ? "pointer" : "default", padding: 0,
                color: i === step ? "var(--color-text-info)" : i < step ? "var(--color-text-success)" : "var(--color-text-tertiary)",
                fontWeight: i === step ? 500 : 400,
              }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500,
                  background: i === step ? "var(--color-background-info)" : i < step ? "var(--color-background-success)" : "var(--color-background-secondary)",
                  color: i === step ? "var(--color-text-info)" : i < step ? "var(--color-text-success)" : "var(--color-text-tertiary)",
                }}>
                  {i < step ? "✓" : i + 1}
                </div>
                {s}
              </button>
              {i < STEPS.length - 1 && <div style={{ width: 18, height: 1, background: "var(--color-border-tertiary)" }} />}
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ ...card, background: "var(--color-background-danger)",
          border: "0.5px solid var(--color-border-danger)", color: "var(--color-text-danger)",
          fontSize: 13, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* ══ STEP 0 — SETUP ══════════════════════════════════════════════════════ */}
      {step === 0 && (
        <>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 10 }}>
              Job description
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={jdUrl} onChange={e => setJdUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && fetchJD()}
                placeholder="Paste a Greenhouse / Lever / Indeed URL and press Enter…"
                style={{ flex: 1, fontSize: 13 }} />
              <button style={btn()} onClick={fetchJD} disabled={loading}>
                {loading ? "Scraping…" : "Scrape ↗"}
              </button>
            </div>
            <textarea value={jdText} onChange={e => handleJdChange(e.target.value)}
              placeholder="Or paste the full job description here…" rows={9}
              style={{ width: "100%", fontSize: 13, resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 5 }}>
              {jdText ? `${jdText.length} chars · ${jdText.split(/\s+/).length} words` : "No JD loaded yet — URL scraping works with Greenhouse, Lever, Indeed, Ashby. Paste for LinkedIn / Workday."}
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 10 }}>
              Your resume
            </div>
            <textarea value={resumeText} onChange={e => handleResumeChange(e.target.value)}
              placeholder={"Paste your resume as plain text here.\n\nTip: include section headers like:\n  TECHNICAL SKILLS\n  Programming Languages: …\n  Tools: …\n\nAnd 'Technologies Used:' lines after each job."}
              rows={16}
              style={{ width: "100%", fontSize: 12, fontFamily: "var(--font-mono)", resize: "vertical", boxSizing: "border-box", lineHeight: 1.65 }} />
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 5 }}>
              {resumeText ? `${resumeText.split(/\s+/).length} words` : "No resume loaded"}
            </div>
          </div>

          <button style={btn("primary")} onClick={analyze} disabled={!jdText || !resumeText}>
            Analyze ATS score →
          </button>
        </>
      )}

      {/* ══ STEP 1 — ATS ANALYSIS ═══════════════════════════════════════════════ */}
      {step === 1 && atsResult && (
        <>
          <div style={{ ...card, display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <ScoreRing score={atsResult.score} label="Current ATS" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>
                {atsResult.score < 50 ? "Critical mismatch" : atsResult.score < 70 ? "Moderate match" : "Good match"}
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                <span style={{ color: "#1D9E75", fontWeight: 500 }}>{atsResult.present.length}</span> keywords matched ·{" "}
                <span style={{ color: "#E24B4A", fontWeight: 500 }}>{atsResult.missing.length}</span> gaps
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>
                {atsResult.score < 50 ? "Significant gaps — the engine will bridge the most important ones."
                  : atsResult.score < 70 ? "Targeted injection will push this well above 70."
                  : "Mostly aligned — a few tweaks will maximise your score."}
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: "var(--color-text-primary)" }}>
              Coverage by category
            </div>
            <CategoryScores present={atsResult.present} missing={atsResult.missing} />
          </div>

          {/* Keyword grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: "1rem" }}>
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#0F6E56", marginBottom: 8 }}>
                ✓ Present · {atsResult.present.length}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {atsResult.present.slice(0, showAll ? 999 : 18).map(k => (
                  <span key={k.keyword} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#E1F5EE", color: "#0F6E56" }}>
                    {k.keyword}<span style={{ opacity: 0.6, marginLeft: 3 }}>×{k.freq}</span>
                  </span>
                ))}
              </div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#993C1D", marginBottom: 8 }}>
                ✗ Missing · {atsResult.missing.length}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {atsResult.missing.slice(0, showAll ? 999 : 18).map(k => (
                  <span key={k.keyword} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#FAECE7", color: "#993C1D" }}>
                    {k.keyword}<span style={{ opacity: 0.6, marginLeft: 3 }}>×{k.freq}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button onClick={() => setShowAll(v => !v)}
            style={{ ...btn(), fontSize: 12, padding: "5px 14px", marginBottom: "1rem" }}>
            {showAll ? "Show fewer" : "Show all keywords"}
          </button>

          {/* Top gaps bar chart */}
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: "var(--color-text-primary)" }}>
              Top gaps by JD weight
            </div>
            {atsResult.missing.slice(0, 8).map((k, i) => (
              <div key={k.keyword} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
                borderBottom: i < 7 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                <div style={{ width: 22, fontSize: 11, color: "var(--color-text-tertiary)" }}>#{i + 1}</div>
                <div style={{ width: 70, fontSize: 10, color: "var(--color-text-tertiary)", textAlign: "center" }}>
                  <span style={{ padding: "1px 5px", borderRadius: 10,
                    background: k.category === "language" ? "#EEEDFE" : k.category === "framework" ? "#E1F5EE" : "#E6F1FB",
                    color: k.category === "language" ? "#3C3489" : k.category === "framework" ? "#0F6E56" : "#185FA5" }}>
                    {k.category}
                  </span>
                </div>
                <div style={{ flex: 1, fontSize: 12, fontFamily: "var(--font-mono)" }}>{k.keyword}</div>
                <div style={{ width: 110, height: 5, background: "var(--color-border-tertiary)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: "#E24B4A",
                    width: `${Math.min(100, (k.freq / (atsResult.missing[0]?.freq || 1)) * 100)}%` }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", width: 24, textAlign: "right" }}>×{k.freq}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn()} onClick={() => setStep(0)}>← Back</button>
            <button style={btn("primary")} onClick={runAdaptation}>Run paraphrase engine →</button>
          </div>
        </>
      )}

      {/* ══ STEP 2 — ADAPT ══════════════════════════════════════════════════════ */}
      {step === 2 && adapted && atsResult && (
        <>
          <div style={{ ...card, display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <ScoreRing score={atsResult.score} label="Before" size={80} />
            <div style={{ fontSize: 22, color: "var(--color-text-tertiary)" }}>→</div>
            <ScoreRing score={adapted.newScore} label="After" size={80} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>
                +{adapted.newScore - atsResult.score} point lift
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                {adapted.changes.length} changes applied
              </div>
              {adapted.newScore >= 90 &&
                <div style={{ fontSize: 12, color: "#1D9E75", marginTop: 4, fontWeight: 500 }}>✓ Target 90+ reached</div>}
            </div>
          </div>

          {adapted.changes.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: "var(--color-text-primary)" }}>
                Engine changes · {adapted.changes.length}
              </div>
              {adapted.changes.map((c, i) => (
                <div key={i} style={{ padding: "8px 0", fontSize: 12,
                  borderBottom: i < adapted.changes.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                  <ChangeBadge type={c.type} />
                  <div style={{ color: "var(--color-text-danger)", opacity: 0.65,
                    textDecoration: "line-through", marginBottom: 3, lineHeight: 1.5 }}>
                    {c.before.length > 110 ? c.before.slice(0, 110) + "…" : c.before}
                  </div>
                  <div style={{ color: "var(--color-text-success)", lineHeight: 1.5 }}>
                    {c.after.length > 110 ? c.after.slice(0, 110) + "…" : c.after}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Adapted resume</div>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Edit freely before exporting</span>
            </div>
            <textarea value={adapted.text}
              onChange={e => setAdapted(prev => ({ ...prev, text: e.target.value }))}
              rows={20}
              style={{ width: "100%", fontSize: 12, fontFamily: "var(--font-mono)", resize: "vertical", boxSizing: "border-box", lineHeight: 1.65 }} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn()} onClick={() => setStep(1)}>← Back</button>
            <button style={btn("primary")} onClick={() => setStep(3)}>Export →</button>
          </div>
        </>
      )}

      {/* ══ STEP 3 — EXPORT ═════════════════════════════════════════════════════ */}
      {step === 3 && (
        <>
          {adapted && (
            <div style={{ ...card, background: "var(--color-background-success)",
              border: "0.5px solid var(--color-border-success)" }}>
              <div style={{ fontSize: 13, color: "var(--color-text-success)", fontWeight: 500 }}>
                ✓ Adapted resume ready · ATS {atsResult?.score} → {adapted.newScore}
              </div>
            </div>
          )}

          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--color-text-primary)" }}>Copy to clipboard</div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>Copy the adapted resume text and paste it anywhere.</div>
            <button style={btn(copied ? "success" : "default")} onClick={copyText}>
              {copied ? "✓ Copied!" : "Copy adapted resume"}
            </button>
          </div>

          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--color-text-primary)" }}>Push to Google Docs</div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 10 }}>
              Provide your resume Google Doc URL. Claude will open it with Google Drive MCP and update the content, preserving your template.
            </div>
            <input value={gdocsUrl} onChange={e => setGdocsUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/… (leave blank to auto-search Drive)"
              style={{ width: "100%", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }} />
            <button style={btn("info")} onClick={pushToGDocs}>Update Google Docs ↗</button>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 8 }}>
              Requires Google Drive connected in Claude settings.
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--color-text-primary)" }}>Email recruiter</div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 10 }}>
              {emailDetected
                ? "Recruiter email auto-detected from the JD — edit if needed."
                : "No email found in the JD — enter the recruiter's address to send."}
            </div>
            <input value={recruiterEmail} onChange={e => setRecruiterEmail(e.target.value)}
              placeholder="recruiter@company.com"
              style={{ width: "100%", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }} />
            <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
              placeholder="Subject"
              style={{ width: "100%", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }} />
            <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={8}
              style={{ width: "100%", fontSize: 13, resize: "vertical", boxSizing: "border-box", lineHeight: 1.6, marginBottom: 10 }} />
            <button style={btn(emailSent ? "success" : "info")} onClick={sendRecruiterEmail}>
              {emailSent ? "✓ Sent to Claude" : "Send via Gmail ↗"}
            </button>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 8 }}>
              Requires Gmail connected in Claude settings. The adapted resume is included in the email body.
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--color-text-primary)" }}>Try another JD</div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>Run the adapted resume against a different job description.</div>
            <button style={btn()} onClick={() => {
              setJdText(""); setJdUrl(""); setAtsResult(null); setAdapted(null); setStep(0);
              setRecruiterEmail(""); setEmailDetected(false); setEmailSubject(""); setEmailBody(""); setEmailSent(false);
            }}>
              New JD, same resume →
            </button>
          </div>

          <button style={btn()} onClick={() => setStep(2)}>← Back to resume</button>
        </>
      )}
    </div>
  );
}
