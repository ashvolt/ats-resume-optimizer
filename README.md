# ATS Resume Optimizer

Paste a job description, get your match score, fix the gaps — push the result to Google Docs. No AI needed for the core pipeline. No signup. No cost.

---

## What it does

Most resumes fail ATS screening not because the candidate is unqualified, but because the resume does not use the same words as the job description. This tool:

1. **Reads the JD** — paste text or scrape a URL automatically
2. **Scores your resume** — algorithmic keyword-frequency match (0–100)
3. **Shows the gaps** — which keywords are missing and how important each one is
4. **Adapts your resume** — a rule-based engine injects missing keywords, upgrades weak verbs, and updates your skills section
5. **Exports** — copy to clipboard or push directly to your Google Docs template

---

## Quick start (30 seconds)

```
Step 1  Paste the job description (or enter URL and click Scrape)
Step 2  Your resume is pre-loaded — edit if needed
Step 3  Click "Analyze ATS score"
Step 4  Review gaps, then click "Run paraphrase engine"
Step 5  Review changes, edit the adapted resume freely
Step 6  Copy to clipboard or push to Google Docs
```

---

## Step-by-step guide

### Step 1 — Enter the job description

**Option A — Paste text (always works)**

1. Open the job posting in your browser
2. Select all the job description text
3. Paste it into the "Job description" text area in the tool

**Option B — Scrape from URL**

1. Copy the job posting URL from your browser address bar
2. Paste it into the URL field at the top of the JD section
3. Press Enter or click "Scrape ↗"
4. The tool fetches the page and extracts the text automatically

> **When URL scraping fails:** LinkedIn, Glassdoor, and Workday block automated scraping. If you see an error, use Option A instead and paste the text manually.

**What makes a good JD input:**
- Include the full posting — requirements, responsibilities, and tech stack sections
- More content = better scoring (the tool needs enough text to identify important keywords)
- Trim or skip the "Benefits / Perks" section — those words add noise without signal

---

### Step 2 — Check your resume

Your resume loads pre-filled as plain text. You can:
- Edit it directly in the text area
- Paste a completely different resume
- Clear it and start fresh

**Formatting tips for best engine results:**
- Keep section headers on their own line: `TECHNICAL SKILLS`, `PROFESSIONAL EXPERIENCE`
- Label skill rows clearly: `Programming Languages:`, `Frameworks:`, `Tools:`, `Databases:`
- Add a `Technologies Used:` line at the end of each job entry — the engine injects missing keywords there safely without touching your achievement bullets
- Bullet points can use `●`, `•`, `-`, or `*` — all are recognised

---

### Step 3 — Review your ATS score

After clicking "Analyze ATS score →" you will see:

**Score gauge** — keyword coverage as 0–100:

| Range | Meaning |
|-------|---------|
| 0–49 | Critical mismatch — unlikely to pass initial screening |
| 50–69 | Moderate match — targeted improvements will help |
| 70–89 | Good match — a few tweaks to maximise chances |
| 90+ | Strong match — you are well positioned |

**Keyword grid** — two columns:
- **Green (Present)** — JD keywords already in your resume, with frequency
- **Red (Missing)** — JD keywords not in your resume, sorted by importance

**Gap chart** — top 8 missing keywords ranked by JD frequency. A keyword appearing 5× matters more than one appearing once. Prioritise these first.

> The score is a keyword-coverage estimate, not a simulation of any specific ATS. Use it as a relative improvement metric — "did the adaptation help?" — not as a pass/fail guarantee.

---

### Step 4 — Run the paraphrase engine

Click "Run paraphrase engine →" to apply automated improvements.

**What the engine changes:**

| Change type | Example |
|------------|---------|
| Verb upgrade | `built` → `engineered`, `used` → `leveraged`, `fixed` → `resolved` |
| Skill added | Adds `TypeScript` to the Languages line (Angular uses TypeScript) |
| Tool added | Adds `Asana`, `Slack` to the Tools line if they appear in the JD |
| Keyword injected | Injects a missing keyword into a contextually relevant bullet |
| Summary updated | Reframes from "frontend specialist" toward "full-stack engineer" |

**What the engine does NOT do:**
- Invent experience you do not have
- Add skills from the JD that have no connection to your existing bullets
- Change your metrics, dates, or company names

**Change log:** Every change is shown with a colour badge and a before/after diff. Review each change — some injections may sound awkward for your specific wording.

---

### Step 5 — Review and edit

The adapted resume is fully editable. You should:

1. Read every changed line
2. Remove anything that is not accurate for your experience
3. Rephrase anything that sounds unnatural
4. Add your own improvements — you may know better ways to include a missing keyword than the engine does

The re-scored gauge at the top confirms how much the coverage improved.

> **On honesty:** The engine is designed to surface keywords from your *existing* experience, not fabricate new ones. If a keyword like `Go` or `Expo` appears in the JD but not in your background, the engine will not add it. Address real skill gaps in your cover letter.

---

### Step 6 — Export

**Copy to clipboard**

Click "Copy adapted resume" — the full text is copied and ready to paste anywhere.

**Push to Google Docs**

1. Paste your Google Doc URL into the field (e.g. `https://docs.google.com/document/d/…`)
2. Click "Update Google Docs ↗"
3. This sends a message to Claude in the chat, who opens the document via the connected Google Drive and updates the content while preserving your template formatting
4. Claude confirms in the chat once done

If you leave the URL blank, Claude searches your Drive for a file with "resume" or "cv" in the name.

> **Requirement:** Google Drive must be connected in your Claude settings. Settings → Tools → Google Drive.

**Generate a formatted .docx**

See the Docx Export section below.

---

## Tips for best results

### Getting a higher ATS score

- Use the exact terminology from the JD. If the JD says "TypeScript", your resume should say "TypeScript", not just "JavaScript"
- Add a `Technologies Used:` line at the end of each job entry — the engine uses this for safe keyword injection
- Keep skills section rows clearly labelled — `Programming Languages:`, `Frameworks:`, `Tools:`, `Databases:`

### Understanding keyword frequency

The number next to each keyword (e.g. `typescript ×6`) is how many times it appears in the JD. Higher = more important. Focus on injecting the high-frequency missing keywords first.

### When to paste vs. scrape

| Job board | Recommendation |
|-----------|---------------|
| LinkedIn | Always paste — scraping is blocked |
| Glassdoor | Always paste — scraping is blocked |
| Workday | Always paste — JS-rendered, scraping is unreliable |
| Greenhouse / Lever / Ashby / BambooHR | URL scraping works reliably |
| Company careers page | Try URL first; if it fails, paste |

---

## Docx export (separate workflow)

To generate a professionally formatted `.docx` file:

**Requirements:** Node.js 18+

```bash
npm install -g docx
node build_resume.js
# Output: Pragash_Resume_StickerMule.docx
```

The generated file uses Calibri font, navy section rules, native Word bullet lists, and right-aligned date columns.

To adapt it for a different role or person, edit the content sections in `build_resume.js` and re-run.

---

## Troubleshooting

**"Could not scrape that URL"**
The URL is blocked by the CORS proxy. Paste the JD text directly — it works for all job boards.

**Score did not improve after adaptation**
The engine could not find confident injection points for the missing keywords. This happens when your resume has no bullets related to the missing technology area. In that case, manually rephrase a bullet to incorporate the keyword.

**The injected text sounds unnatural**
Edit it. The adapted resume textarea is fully editable. The engine's output is a starting point.

**Google Docs update did not work**
- Confirm Google Drive is connected in Claude settings
- Check the Doc URL includes your document ID
- Confirm you have edit access to the document

**My resume sections were not detected**
The engine looks for standard section header names. If you use non-standard names (e.g. "Core Competencies" instead of "Skills"), rename them to standard names in the text area before running the engine.

---

## How the score is calculated

Everything runs client-side with no API calls:

1. **Tokenise** both texts — lowercase, strip punctuation, remove stop words
2. **Build a JD frequency map** — count each unique word and phrase
3. **Bigrams** (two-word phrases) get 1.5× weight because specific phrases matter more than single words
4. **Filter** to the top 60 JD keywords by frequency weight
5. **Match** each keyword against the resume (case-insensitive substring)
6. **Score** = matched frequency weight / total frequency weight × 100

---

## Privacy

- All processing happens in your browser — your resume text is never sent to any server
- URL scraping goes through the public CORS proxy `allorigins.win` — do not use private or authenticated URLs
- Google Docs updates use your own connected Google account via Claude's Google Drive integration

---

## Project files

```
ats-resume-builder.jsx    Main tool (open in Claude as a React artifact)
build_resume.js           Node.js script to generate a formatted .docx
README.md                 This file — user guide
FEATURES.md               Full feature list with current status
DEVELOPMENT_PLAN.md       Technical architecture and improvement roadmap
```

---

*Version 0.1 — Prototype. See DEVELOPMENT_PLAN.md for known issues and the improvement roadmap.*
