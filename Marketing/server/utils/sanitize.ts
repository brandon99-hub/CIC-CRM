export function sanitizeSearchInput(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input.replace(/[%_\\]/g, "\\$&").slice(0, 200);
}

export function sanitizeInteger(input: any, defaultVal: number, min: number, max: number): number {
  const parsed = parseInt(input);
  if (isNaN(parsed)) return defaultVal;
  return Math.max(min, Math.min(max, parsed));
}

export function sanitizeUUID(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(input) ? input : null;
}
