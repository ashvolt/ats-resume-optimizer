import type { ResumeContact, ResumeMeta } from "../schema/resume";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const NAME_RE = /^([A-Z][a-z]+(?:\s[A-Z][.a-z]+){1,3})$/;

/** Best-effort contact-block extraction from the first few non-empty lines of a resume. */
export function extractMeta(text: string): ResumeMeta {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6);

  const nameLine = lines.find((l) => NAME_RE.test(l));
  const email = text.match(EMAIL_RE)?.[0];
  const phone = lines.join(" ").match(PHONE_RE)?.[0]?.trim();

  const contact: ResumeContact = {};
  if (email) contact.email = email;
  if (phone) contact.phone = phone;

  return {
    name: nameLine ?? lines[0] ?? "Untitled Resume",
    contact,
  };
}
