const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  HeadingLevel, LevelFormat, BorderStyle, SpacingType,
  UnderlineType, TabStopType, TabStopPosition,
} = require("docx");
const fs = require("fs");

// ── Colour palette ────────────────────────────────────────────────────────────
const ACCENT  = "1A5C8F";  // dark-navy blue for name / section lines
const MUTED   = "555555";  // secondary text (role title, dates, contact)
const BLACK   = "111111";  // body text

// ── Helpers ───────────────────────────────────────────────────────────────────
const sp = (before = 0, after = 0, line = null) => ({
  spacing: {
    before,
    after,
    ...(line ? { line, lineRule: SpacingType.EXACT } : {}),
  },
});

const run = (text, opts = {}) =>
  new TextRun({ text, font: "Calibri", size: 20, color: BLACK, ...opts });

const boldRun = (text, opts = {}) =>
  run(text, { bold: true, ...opts });

// Thin horizontal rule under section headings
const sectionRule = {
  border: {
    bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 1 },
  },
};

function sectionHeading(label) {
  return new Paragraph({
    ...sectionRule,
    ...sp(160, 60),
    children: [
      new TextRun({
        text: label.toUpperCase(),
        bold: true,
        size: 22,
        font: "Calibri",
        color: ACCENT,
        characterSpacing: 40,
      }),
    ],
  });
}

function bullet(text, indentLevel = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level: indentLevel },
    ...sp(20, 20),
    children: [run(text, { size: 19 })],
  });
}

function bulletMixed(parts) {
  // parts = [{text, bold?}]
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    ...sp(20, 20),
    children: parts.map(p =>
      p.bold ? boldRun(p.text, { size: 19 }) : run(p.text, { size: 19 })
    ),
  });
}

function jobHeader(title, company, period, location) {
  return [
    new Paragraph({
      ...sp(120, 0),
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        boldRun(title, { size: 21, color: BLACK }),
        run("\t", { size: 21 }),
        run(period, { size: 19, color: MUTED, italics: true }),
      ],
    }),
    new Paragraph({
      ...sp(0, 40),
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        run(company, { color: MUTED, size: 19, italics: true }),
        run("\t", { size: 19 }),
        run(location, { color: MUTED, size: 19 }),
      ],
    }),
  ];
}

function techLine(techs) {
  return new Paragraph({
    ...sp(30, 0),
    children: [
      boldRun("Tech: ", { size: 18, color: MUTED }),
      run(techs, { size: 18, color: MUTED }),
    ],
  });
}

function skillRow(label, value) {
  return new Paragraph({
    ...sp(28, 0),
    children: [
      boldRun(label + ":  ", { size: 19 }),
      run(value, { size: 19 }),
    ],
  });
}

// ── Document ──────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: 480, hanging: 260 },
              },
            },
          },
        ],
      },
    ],
  },

  styles: {
    default: {
      document: { run: { font: "Calibri", size: 20, color: BLACK } },
    },
  },

  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 900, bottom: 900, left: 1080, right: 1080 },
        },
      },
      children: [

        // ════════════════ NAME & CONTACT ════════════════════════════════════
        new Paragraph({
          alignment: AlignmentType.CENTER,
          ...sp(0, 40),
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 6 },
          },
          children: [
            new TextRun({
              text: "PRAGASH M",
              bold: true,
              size: 44,
              font: "Calibri",
              color: ACCENT,
              characterSpacing: 60,
            }),
          ],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          ...sp(40, 10),
          children: [
            run("Full-Stack Software Engineer", { size: 22, color: MUTED, italics: true }),
          ],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          ...sp(0, 140),
          children: [
            run("+91 8056935035  ·  pragashvenkat@gmail.com  ·  LinkedIn  ·  GitHub", {
              size: 18, color: MUTED,
            }),
            run("  ·  India (Puducherry)  ·  Open to remote", { size: 18, color: MUTED }),
          ],
        }),

        // ════════════════ SUMMARY ════════════════════════════════════════════
        sectionHeading("Professional Summary"),

        new Paragraph({
          ...sp(60, 60),
          children: [
            run(
              "Full-stack software engineer with 8+ years delivering scalable web platforms, " +
              "SaaS products, and microservice APIs across TypeScript, React, Angular, Node.js, " +
              "and .NET Core. Experienced building product-grade REST APIs, real-time systems with " +
              "SignalR, and payment & billing workflows. Comfortable working autonomously in small " +
              "remote teams, leveraging AI tools (GitHub Copilot) to ship fast and maintain quality. " +
              "Proven track record across enterprise SaaS, commerce-adjacent platforms, and " +
              "high-availability microservices.",
              { size: 19 }
            ),
          ],
        }),

        // ════════════════ SKILLS ═════════════════════════════════════════════
        sectionHeading("Technical Skills"),

        skillRow("Languages",    "TypeScript, JavaScript, SQL"),
        skillRow("Frontend",     "React (TypeScript), Angular, HTML5, CSS3, SCSS, Component Architecture, MFE"),
        skillRow("Backend",      "Node.js, .NET Core, Express.js, REST APIs, SignalR"),
        skillRow("Databases",    "PostgreSQL, MongoDB, Cassandra, Redis"),
        skillRow("Tools",        "Git, Asana, Slack, Jira, GitHub Actions, CI/CD"),
        skillRow("Architecture", "Microservices, API Gateway (Ocelot), IAM, SSO, RBAC, SPA"),
        skillRow("Practices",    "AI-assisted development (GitHub Copilot), Agile/Scrum, Code Review, TDD"),

        // ════════════════ EXPERIENCE ══════════════════════════════════════════
        sectionHeading("Professional Experience"),

        // Dell
        ...jobHeader(
          "Senior Software Consultant",
          "Dell Technologies (Contractor via Turing)",
          "Jul 2022 – Present",
          "Remote"
        ),

        bullet(
          "Architected full-stack SPAs and micro frontends using TypeScript + Angular, aligned to " +
          "design systems and WCAG accessibility standards, cutting initial render time by 35%."
        ),
        bullet(
          "Engineered .NET Core and Node.js microservices with Redis, SignalR, and MongoDB, " +
          "improving reliability by 30% and sustaining ~1,200 concurrent users under load."
        ),
        bullet(
          "Designed and enforced Ocelot API Gateway configuration for cookie/SSO auth and " +
          "role-based access control across all services — ensuring security consistency."
        ),
        bullet(
          "Defined structured observability and logging standards with reusable data-view " +
          "components, saving 6–8 hours of cross-team troubleshooting per week."
        ),
        bullet(
          "Leveraged GitHub Copilot and AI-assisted workflows to accelerate delivery; mentored " +
          "junior engineers and streamlined CI/CD pipelines, reducing post-release defects by 25%."
        ),
        bullet(
          "Collaborated asynchronously across time zones using Slack and Asana, " +
          "shipping features on a weekly cadence in a fully remote setup."
        ),
        techLine("TypeScript, Angular, .NET Core, Node.js, MongoDB, Redis, SignalR, Ocelot, CI/CD"),

        // RexEMR
        ...jobHeader(
          "Software Engineer – UI/UX",
          "RexEMR Pvt. Ltd",
          "Jun 2021 – Jul 2022",
          "Puducherry"
        ),

        bullet(
          "Led end-to-end development of an EMR SaaS platform (Angular/TypeScript + Node.js REST APIs), " +
          "delivering a responsive UI and reusable component library from the ground up."
        ),
        bullet(
          "Built insurance billing submission and claims-validation workflows — payment-critical flows " +
          "analogous to e-commerce checkout — increasing on-time submissions by 50% and cutting " +
          "rejected claims by 20%."
        ),
        bullet(
          "Streamlined patient profile and medication management UX, reducing task-completion time by 30%."
        ),
        bullet(
          "Boosted patient portal adoption by 18% in six months by redesigning onboarding flows " +
          "and adding contextual in-product help."
        ),
        bullet(
          "Achieved 85% automated test pass rate via component-level test suites, " +
          "significantly reducing production hotfix rate."
        ),
        techLine("TypeScript, Angular, Node.js, Express.js, PostgreSQL, HTML, CSS"),

        // Relevantz
        ...jobHeader(
          "Software Engineer",
          "Relevantz Technology Services",
          "Jun 2017 – Jun 2021",
          "Puducherry"
        ),

        bullet(
          "Delivered features for a high-traffic bidding and EMI payments platform " +
          "(Angular/TypeScript), increasing digital transactions by 35%."
        ),
        bullet(
          "Migrated a legacy AngularJS codebase to modern Angular/TypeScript, " +
          "improving maintainability and runtime performance by 40%."
        ),
        bullet(
          "Built a reusable TypeScript component library and shared UI patterns, " +
          "reducing cross-project rework by 30%."
        ),
        bullet(
          "Implemented lazy loading and component memoization, keeping page load under 1.2 s " +
          "as traffic doubled — ensuring scalable reliability."
        ),
        bullet(
          "Championed unit testing and structured peer-review culture, lowering production defects by 25%."
        ),
        techLine("TypeScript, Angular, AngularJS, JavaScript, Node.js, SQL, PostgreSQL"),

        // ════════════════ PROJECTS ════════════════════════════════════════════
        sectionHeading("Projects"),

        // Log Management MFE
        new Paragraph({
          ...sp(100, 0),
          children: [
            boldRun("Log Management Micro Frontend  ", { size: 20 }),
            run("· Dell Technologies / Turing", { size: 19, color: MUTED, italics: true }),
          ],
        }),
        new Paragraph({
          ...sp(0, 30),
          children: [
            run(
              "Full-stack product for cross-functional teams to visualise, filter, and act on " +
              "operational logs in real time.",
              { size: 19, color: MUTED }
            ),
          ],
        }),
        bullet(
          "Built Angular (TypeScript) MFE with role-based configurable views; onboarding new " +
          "log sources required zero code changes, cutting setup time by 60% (~20–25 hrs/month saved)."
        ),
        bullet(
          "Delivered .NET Core REST APIs backed by MongoDB with RBAC, improving query latency by 45% " +
          "for ~1,200 concurrent users."
        ),
        bullet(
          "Defined observability standards adopted by 3 cross-functional engineering teams."
        ),

        // EMR Web App
        new Paragraph({
          ...sp(100, 0),
          children: [
            boldRun("EMR SaaS Platform  ", { size: 20 }),
            run("· RexEMR Pvt. Ltd", { size: 19, color: MUTED, italics: true }),
          ],
        }),
        new Paragraph({
          ...sp(0, 30),
          children: [
            run(
              "End-to-end healthcare SaaS for clinicians to manage patient records and " +
              "submit insurance claims.",
              { size: 19, color: MUTED }
            ),
          ],
        }),
        bullet(
          "Delivered Angular + Node.js microservices for patient workflows, reducing per-record " +
          "update time by 30% and improving task throughput by 4 min/record."
        ),
        bullet(
          "Built claims-upload and validation pipeline increasing on-time submissions by 50%."
        ),

        // ════════════════ EDUCATION ═══════════════════════════════════════════
        sectionHeading("Education"),

        new Paragraph({
          ...sp(60, 10),
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            boldRun("Master of Business Management", { size: 20 }),
            run("\t", { size: 20 }),
            run("Jan 2026", { size: 19, color: MUTED, italics: true }),
          ],
        }),
        new Paragraph({
          ...sp(0, 40),
          children: [run("Pondicherry University, Puducherry, India", { size: 19, color: MUTED })],
        }),

        new Paragraph({
          ...sp(40, 10),
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            boldRun("Bachelor of Technology – Information Technology", { size: 20 }),
            run("\t", { size: 20 }),
            run("Jun 2017", { size: 19, color: MUTED, italics: true }),
          ],
        }),
        new Paragraph({
          ...sp(0, 40),
          children: [run("Pondicherry University, Puducherry, India", { size: 19, color: MUTED })],
        }),

        // ════════════════ LANGUAGES ═══════════════════════════════════════════
        sectionHeading("Languages"),

        new Paragraph({
          ...sp(60, 0),
          children: [
            run("English (Professional)   ·   Tamil (Native)", { size: 19 }),
          ],
        }),

      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/claude/Pragash_Resume_StickerMule.docx", buf);
  console.log("Done");
});
