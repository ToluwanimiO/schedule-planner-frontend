let counter = 0;
/** Stable unique id for entities. Never derived from array position. */
export function newId(prefix = "id"): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${(counter++).toString(36)}`;
  return `${prefix}_${rand}`;
}
