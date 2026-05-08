function splitPiNames(rawNames: string): string[] {
  return rawNames
    .split(";")
    .map((name) => name.trim())
    .filter(Boolean);
}

function stripContactTag(name: string): string {
  return name.replace(/\s*\(contact\)\s*/gi, " ").replace(/\s+/g, " ").trim();
}

function isContactName(name: string): boolean {
  return /\(contact\)/i.test(name);
}

function getLastName(value: string): string {
  const cleaned = stripContactTag(value);
  const parts = cleaned.split(/\s+/);
  return parts[parts.length - 1]?.toLowerCase() ?? "";
}

export function getOrderedPiNames(rawNames: string | undefined): string[] {
  if (!rawNames) return [];
  const names = splitPiNames(rawNames);
  const contactNames = names
    .filter(isContactName)
    .map(stripContactTag);
  const nonContactNames = names
    .filter((name) => !isContactName(name))
    .map(stripContactTag)
    .sort((a, b) => getLastName(a).localeCompare(getLastName(b)));
  return [...contactNames, ...nonContactNames].filter(Boolean);
}

export function formatPiNamesForInlineDisplay(rawNames: string | undefined): string {
  const names = getOrderedPiNames(rawNames);
  return names.length > 0 ? names.join("; ") : "—";
}
