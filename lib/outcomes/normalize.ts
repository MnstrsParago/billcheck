/**
 * Normalize a hospital name into a stable key for grouping outcomes.
 * "The Riverside General Hospital, Inc." -> "riverside general hospital inc"
 */
export function normalizeHospital(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "") // St. Mary's -> st marys
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^the /, "");
}
