/** Strips common JD boilerplate that adds no scoring signal. Ported from ats-resume-builder.jsx. */
export function cleanJdText(raw: string): string {
  return raw
    .replace(/\$[\d,]+[k\s\-–—/][\s\S]{0,200}?(per year|annually|\/yr)/gi, "")
    .replace(/(apply now|submit your application|click to apply)[\s\S]{0,100}/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}
