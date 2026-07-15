/**
 * Canonical Resume schema. Source of truth per docs/architecture.md §3.1 and ADR-005 —
 * downstream docs/schema examples must stay in lockstep with these types, not the other way around.
 */

export interface Link {
  label: string;
  url: string;
}

export type BulletOrigin = "user" | "ai-suggested" | "ai-accepted";

export interface Bullet {
  id: string;
  text: string;
  origin: BulletOrigin;
}

export interface ResumeEntry {
  id: string;
  heading?: string;
  subheading?: string;
  bullets: Bullet[];
  tags?: string[];
}

export type ResumeSectionType =
  | "summary"
  | "experience"
  | "projects"
  | "education"
  | "skills"
  | "certifications"
  | "achievements"
  | "custom";

export interface ResumeSection {
  id: string;
  type: ResumeSectionType;
  title: string;
  entries: ResumeEntry[];
}

export interface ResumeContact {
  email?: string;
  phone?: string;
  location?: string;
  links?: Link[];
}

export interface ResumeMeta {
  name: string;
  title?: string;
  contact: ResumeContact;
}

export interface Resume {
  id: string;
  schemaVersion: 1;
  meta: ResumeMeta;
  sections: ResumeSection[];
  markdownSource: string;
  createdAt: string;
  updatedAt: string;
}
