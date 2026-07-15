/**
 * Resume JSON -> canonical Markdown. Convention fixed by docs/features/markdown-engine.md.
 * `parseMarkdown(renderMarkdown(r))` must be structurally equivalent to `r` — see its test file.
 */

import type { Resume } from "../schema/resume";

export function renderMarkdown(resume: Resume): string {
  const lines: string[] = [`# ${resume.meta.name}`];
  if (resume.meta.title) lines.push(resume.meta.title);

  const contactParts = [resume.meta.contact.email, resume.meta.contact.phone, resume.meta.contact.location].filter(
    (v): v is string => Boolean(v),
  );
  if (contactParts.length > 0) lines.push(contactParts.join(" | "));
  lines.push("");

  for (const section of resume.sections) {
    lines.push(`## ${section.title}`);
    for (const entry of section.entries) {
      if (entry.heading) lines.push(`### ${entry.heading}`);
      if (entry.subheading) lines.push(entry.subheading);
      for (const bullet of entry.bullets) lines.push(`- ${bullet.text}`);
      lines.push("");
    }
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}
