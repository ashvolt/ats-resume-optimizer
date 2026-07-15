> **Superseded.** This is the v0.1 prototype's feature list. The v1 spec lives in [`docs/features/`](docs/features/), with `docs/requirements.md` as the canonical functional requirements doc. Retained for historical reference and status comparison.

# Features

Complete feature specification for the ATS Resume Optimizer.  
Status: `✅ Done` · `🔧 Partial` · `⚠ Broken` · `🗓 Planned`

---

## Core Features

### F-01 · JD Input — Paste Text
**Status:** ✅ Done  
**What it does:** Accepts a job description pasted directly into a textarea.  
**How to use:** Click the "Job description" text area and paste. The word/character count updates live.  
**Notes:** This is always the most reliable input method. Recommended over URL scraping for LinkedIn, Glassdoor, and Workday.

---

### F-02 · JD Input — URL Scrape
**Status:** 🔧 Partial  
**What it does:** Fetches a job posting URL through a CORS proxy, strips navigation/footer HTML, and extracts the job description text.  
**How to use:** Paste a job posting URL into the URL field and press Enter or click "Scrape ↗".  
**Supported job boards:**
| Board | Works? | Notes |
|-------|--------|-------|
| Greenhouse | ✅ | Reliable |
| Lever | ✅ | Reliable |
| Indeed | ✅ | May rate-limit |
| Ashby | ✅ | Reliable |
| BambooHR | ✅ | Reliable |
| Company careers pages | ⚠ | Varies by site |
| LinkedIn | ❌ | Auth wall — paste manually |
| Workday | ❌ | JavaScript-rendered — paste manually |
| Glassdoor | ❌ | Blocked by proxy |

**Known issues:**  
- No timeout implemented — hangs if proxy is slow (fix in P0)
- Single proxy (`allorigins.win`) with no fallback (fix in P2)
- Fetches full page including benefits/culture text (fix in P1 with section parser)

**Workaround:** If a URL fails, paste the JD text directly. Most job boards let you select-all and copy cleanly.

---

### F-03 · ATS Score
**Status:** 🔧 Partial  
**What it does:** Calculates a keyword-frequency match score (0–100) between the JD and the resume.  
**How to use:** After entering both JD and resume, click "Analyze ATS score →". A gauge with a score, keyword count, and gap summary is shown.  
**Algorithm (current):**  
1. Tokenize both texts — lowercase, strip punctuation, remove stop words.  
2. Build a frequency map: unigrams get count × 1, bigrams get count × 1.5.  
3. Take the top 60 JD keywords by frequency.  
4. Score = (sum of matched keyword frequencies) / (total keyword frequencies) × 100.

**Known issues:**  
- ⚠ Bigrams currently cross sentence boundaries (`"developer. skills"`, `"5+ typescript"`) — see DEVELOPMENT_PLAN.md Phase 1
- ⚠ Tech terms score 0/20 in tests because punctuation-attached tokens (`"react,"`) don't match the clean TECH_TERMS set
- ⚠ No JD section weighting — benefits/perks text counted equally as requirements
- Score capped at 97 (no documented reason)

---

### F-04 · Keyword Gap Analysis
**Status:** ✅ Done  
**What it does:** Shows present keywords (green tags) and missing keywords (red tags), sorted by JD frequency weight. A bar chart shows the top 8 gaps ranked by importance.  
**How to use:** Available on the ATS Analysis screen (Step 2). Toggle "Show all keywords" to see beyond the default 18.  
**Upcoming improvement:** Keywords will be grouped by category (Language, Framework, Tool, etc.) so you can see at a glance what *type* of gaps exist.

---

### F-05 · Paraphrase / Adaptation Engine
**Status:** ⚠ Broken (partial functionality)  
**What it does:** Applies rule-based transformations to the resume text to improve keyword coverage.  
**Current passes:**

| Pass | What it does | Status |
|------|-------------|--------|
| Summary reframe | Changes "focused on frontend" → "full-stack" | ⚠ Hardcoded to Pragash's resume only |
| TypeScript injection | Adds TypeScript to Programming Languages line | ✅ Works for standard resume format |
| React boost | Adds "(TypeScript)" after React in Frameworks line | ✅ Works |
| Tools injection | Adds Asana/Slack to Tools line | ✅ Works |
| Verb upgrade | Replaces weak verbs (built → engineered, etc.) | ✅ Works |
| Keyword injection into bullets | Appends `, leveraging {kw}.` to matching bullets | ⚠ Creates awkward text; `go` keyword false-positives |
| Tech stack enrichment | Appends missing tech to "Technologies Used:" lines | 🔧 Only works if that exact header exists |

**How to use:** After viewing the ATS score, click "Run paraphrase engine →". A before/after score gauge and change log are shown.  
**Known issues:** See DEVELOPMENT_PLAN.md Phase 2 for full redesign.

---

### F-06 · Editable Adapted Resume
**Status:** ✅ Done  
**What it does:** The adapted resume text is displayed in an editable textarea. You can manually edit any changes before exporting.  
**How to use:** On the Adapt screen (Step 3), the textarea is fully editable. Changes you make are preserved through to the Export step.

---

### F-07 · Change Log
**Status:** ✅ Done  
**What it does:** Displays every change the paraphrase engine made, with a color-coded badge (verb upgrade / keyword added / skill updated / tool added) and a before/after line diff.  
**How to use:** Shown automatically after adaptation runs, above the edited resume textarea.

---

### F-08 · Before/After Score Comparison
**Status:** ✅ Done  
**What it does:** Shows two score gauges (before and after adaptation) side by side with the point improvement.  
**How to use:** Visible at the top of the Adapt screen.

---

### F-09 · Copy to Clipboard
**Status:** ✅ Done  
**What it does:** Copies the adapted resume text to the clipboard.  
**How to use:** On the Export screen (Step 4), click "Copy adapted resume". The button turns green and shows "✓ Copied!" for 2.5 seconds.

---

### F-10 · Push to Google Docs
**Status:** ✅ Done (via Claude MCP)  
**What it does:** Sends the adapted resume to Claude, which then uses the connected Google Drive MCP to find and update your resume Google Doc.  
**How to use:**
1. On the Export screen, paste your Google Doc URL (e.g. `https://docs.google.com/document/d/…`)  
2. Click "Update Google Docs ↗"
3. This fires a message to Claude in the chat
4. Claude opens your Google Doc and updates the content, preserving your template formatting
5. Claude confirms with a summary of what changed

**Notes:** If you leave the URL blank, Claude will search your Google Drive for a file with "resume" or "cv" in the name. Works best if you provide the URL directly.  
**Requires:** Google Drive connected in Claude settings.

---

### F-11a · Email Recruiter (via Gmail MCP)
**Status:** ✅ Done  
**What it does:** Auto-detects a recruiter email address from the JD text (regex scan, preferring addresses containing `recruit/talent/hr/careers/jobs/hiring`), and auto-drafts a subject + body using the JD's first line as job title and the resume's first line as the applicant's name. Shown on the Export screen.  
**How to use:**
1. After analyzing a JD, the email card pre-fills recruiter email (if found), subject, and body.
2. Edit any field — including the recruiter email if none was detected or it's wrong.
3. Click "Send via Gmail ↗" — fires a prompt to Claude, which uses the connected Gmail MCP to send the email with the adapted resume text included below the signature.
4. Claude confirms once sent.

**Notes:** No backend mail server — sending is delegated to Claude + Gmail MCP, same pattern as F-10 (Push to Google Docs). Requires Gmail connected in Claude settings. If no email is found in the JD, the field starts blank and the user must supply one.

---

### F-11 · Docx Export
**Status:** 🔧 Partial (separate script, not integrated into UI)  
**What it does:** Generates a formatted `.docx` resume file using the `docx` npm package.  
**How to use:** Run `node build_resume.js` from the project root. Outputs `Pragash_Resume_StickerMule.docx`.  
**Planned:** In-browser `.docx` export button on the Export screen (Phase 3).

---

### F-12 · Session Persistence
**Status:** 🗓 Planned (Phase 2)  
**What it will do:** Save the JD, resume text, and ATS scores to browser storage so they survive page refresh.  
**Why it matters:** Currently, refreshing the page loses all your work. With persistence, you can compare the same resume against multiple JDs across sessions.

---

### F-13 · Multi-JD Comparison
**Status:** 🗓 Planned (Phase 3)  
**What it will do:** Run one resume against multiple JDs and display a comparison table showing score, top gaps, and recommended changes for each.  
**Use case:** You're applying to 5 companies. See which is the closest match and which needs the most work before applying.

---

### F-14 · PDF / Docx Resume Upload
**Status:** 🗓 Planned (Phase 3)  
**What it will do:** Accept a `.pdf` or `.docx` resume as input and extract the text automatically, replacing the manual paste step.  
**Why it's not built yet:** Requires a PDF-to-text library (pdf.js or similar) to be loaded in the browser context.

---

### F-15 · Score History
**Status:** 🗓 Planned (Phase 3)  
**What it will do:** Track ATS scores across iterations (original → after adaptation → after manual edits) and display as a mini chart.  
**Use case:** See how each pass of editing improves your score over time.

---

### F-16 · Role-Title Normalisation (Smart Summary)
**Status:** 🗓 Planned (Phase 2)  
**What it will do:** Detect the target role title from the JD (e.g., "Full-Stack Software Engineer") and automatically rewrite the resume summary's opening role description to match, regardless of the user's current wording.  
**How it works:** Extract the first bold/large text in the JD as the role title, then replace the title phrase in the resume summary using a sentence template.

---

### F-17 · Keyword Category Breakdown (Dashboard View)
**Status:** 🗓 Planned (Phase 1)  
**What it will do:** Group keywords by category (Languages, Frameworks, Tools, Databases, Cloud, Methodologies) and show a mini-score per category.  
**Example output:**
```
Languages   ████████░░  8/10  ← TypeScript missing
Frameworks  ██████████  10/10 ✓
Databases   ████░░░░░░  4/10  ← PostgreSQL, Redis missing
Cloud       ██░░░░░░░░  2/10  ← GCP, Docker missing
Tools       ████████░░  8/10  ← Asana missing
```

---

## Feature Flags (for future toggles)

| Flag | Default | Description |
|------|---------|-------------|
| `strict_injection` | `off` | Only inject keywords that appear ≥ 3× in JD (vs current 2×) |
| `skills_only_mode` | `off` | Only update skills section — never touch bullet points |
| `preserve_summary` | `off` | Skip the summary reframe pass entirely |
| `show_noise_words` | `off` | Show filtered-out JD noise words for debugging |
| `debug_mode` | `off` | Show token counts, section weights, and classification labels |

---

## Out of Scope

These will not be built as part of this project:

- **AI-generated bullet points** — The tool improves coverage of existing content; it does not generate new claims. Fabricating experience is both dishonest and counterproductive.
- **Interview coaching** — Out of scope; focus is resume only.
- **Job matching / recommendations** — The tool is JD-specific; it does not find or rank jobs.
- **Linkedin profile export** — Requires authenticated access.
- **Cover letter generation** — Considered for Phase 4 but deprioritised.
