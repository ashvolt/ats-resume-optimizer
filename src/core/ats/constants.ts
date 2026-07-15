/**
 * Deterministic-engine lexicon. Ported from the v0.2 prototype (ats-resume-builder.jsx),
 * which already carries the DEVELOPMENT_PLAN.md Phase-1 bug fixes (sentence-boundary bigrams,
 * tech-term normalization, JD section weighting, noise filtering) — kept in lockstep here as
 * the canonical typed source rather than re-derived from scratch. See ADR-004.
 */

import type { KeywordCategory } from "../schema/job-description";
import type { JdSectionLabel } from "../schema/job-description";

export const STOPWORDS: ReadonlySet<string> = new Set(
  (
    "a an the and or but in on at to for of with by from as is was are were be " +
    "been being have has had do does did will would could should may might shall " +
    "can this that these those it its i we you he she they them their our your my " +
    "his her what which who how when where why all each every both few more most " +
    "other some such no not only same so than too very just about above after " +
    "before between during through under until up upon while also into over then " +
    "there here use using used year work working experience team teams company " +
    "build building help make making across within including ensure strong ability " +
    "responsible requirements preferred nice good plus bonus required must like " +
    "new one two three four five six seven eight nine ten need needs provide " +
    "support based way get gets getting take takes taking per day week month etc"
  ).split(" "),
);

/** JD boilerplate that carries zero signal about candidate skills. */
export const JD_NOISE: ReadonlySet<string> = new Set(
  (
    "passionate excited love fun thrive culture mission self-starter fast-paced " +
    "startup opportunity competitive salary benefits unlimited vacation pto " +
    "insurance equity stock options office snacks lunch catered retreat " +
    "collaborative motivated driven talented world-class innovative disrupting " +
    "revolutionize impact seeking looking hiring join candidate individual " +
    "growing scaling funding investors environment ideal"
  ).split(" "),
);

/** Verified tech terms — always extracted regardless of raw frequency. */
export const TECH_TERMS: ReadonlySet<string> = new Set(
  (
    "typescript javascript python golang go rust java kotlin swift ruby php sql " +
    "cpp scala elixir react angular vue svelte remix solid nextjs nuxt expo " +
    "flutter ios android express fastapi django rails spring gin fiber graphql " +
    "rest grpc websocket trpc oauth jwt postgresql mysql mongodb redis " +
    "elasticsearch cassandra dynamodb supabase firebase sqlite aws gcp azure " +
    "vercel netlify docker kubernetes terraform ansible webpack vite jest cypress " +
    "playwright vitest jira asana notion linear slack figma github gitlab " +
    "microservices cicd tdd bdd agile scrum devops openai llm langchain " +
    "node nodejs react-native"
  ).split(" "),
);

/** Keyword categories — used both for the score breakdown and suggestion-injection routing. */
export const KEYWORD_CATEGORIES: Record<Exclude<KeywordCategory, "general">, ReadonlySet<string>> = {
  language: new Set("typescript javascript python golang go rust java kotlin swift ruby php sql cpp scala r".split(" ")),
  framework: new Set(
    "react angular vue svelte nextjs nuxt remix solid expo flutter express fastapi django rails spring gin fiber".split(
      " ",
    ),
  ),
  database: new Set("postgresql mysql mongodb redis elasticsearch cassandra dynamodb supabase firebase sqlite".split(" ")),
  cloud: new Set("aws gcp azure vercel netlify docker kubernetes terraform heroku".split(" ")),
  tool: new Set("jira asana notion linear slack figma github gitlab jest cypress playwright vitest graphql rest grpc websocket trpc oauth jwt".split(" ")),
  methodology: new Set("microservices cicd tdd bdd agile scrum devops".split(" ")),
};

/** Normalize alternate spellings to a canonical token before matching. */
export const NORMALISE: Readonly<Record<string, string>> = {
  nodejs: "node.js",
  nextjs: "next.js",
  nuxtjs: "nuxt.js",
  reactjs: "react",
  vuejs: "vue",
  cpp: "c++",
  k8s: "kubernetes",
  postgres: "postgresql",
  psql: "postgresql",
  ts: "typescript",
  js: "javascript",
};

/** Weak verb → stronger replacement, used by the (future M3) suggestion engine. */
export const VERB_MAP: Readonly<Record<string, string>> = {
  built: "engineered",
  created: "architected",
  made: "developed",
  helped: "contributed to",
  used: "leveraged",
  did: "executed",
  wrote: "authored",
  fixed: "resolved",
  changed: "optimized",
  added: "implemented",
  "set up": "established",
  handled: "managed",
  ran: "spearheaded",
  showed: "demonstrated",
  "worked on": "delivered",
  "responsible for": "owned",
};

/** JD section weight multipliers + normalized label, in priority order (first match wins). */
export const SECTION_WEIGHTS: ReadonlyArray<{ re: RegExp; label: JdSectionLabel; weight: number }> = [
  { re: /\b(requirements?|must.have|qualifications?|you.will.need|what we.re looking)\b/i, label: "requirements", weight: 2.0 },
  { re: /\b(what you.ll do|responsibilities|you will|what you will)\b/i, label: "responsibilities", weight: 1.5 },
  { re: /\b(nice.to.have|preferred|bonus|good.to.have|great.to.have)\b/i, label: "preferred", weight: 0.5 },
  {
    re: /\b(about.us|why.join|benefits|perks|what.we.offer|compensation|salary|pto|insurance|equity|culture|life.at)\b/i,
    label: "about",
    weight: 0,
  },
];
