import type { Bullet, Resume, ResumeSectionType } from "../schema/resume";

/** Every bullet across every section/entry, for verb/impact-metric checks. */
export function allBullets(resume: Resume): Bullet[] {
  return resume.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets));
}

/** Lowercased searchable text: section titles, entry headings/subheadings, bullets, tags. */
export function flattenResumeText(resume: Resume): string {
  const parts: string[] = [];
  for (const section of resume.sections) {
    parts.push(section.title);
    for (const entry of section.entries) {
      if (entry.heading) parts.push(entry.heading);
      if (entry.subheading) parts.push(entry.subheading);
      if (entry.tags) parts.push(...entry.tags);
      for (const bullet of entry.bullets) parts.push(bullet.text);
    }
  }
  return parts.join(" \n ").toLowerCase();
}

export function presentSectionTypes(resume: Resume): Set<ResumeSectionType> {
  return new Set(resume.sections.map((s) => s.type));
}
