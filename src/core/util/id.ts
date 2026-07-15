let counter = 0;

/** Monotonic, collision-safe id generator — not cryptographically random, not needed to be. */
export function generateId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
