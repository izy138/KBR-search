import activityCodeTitles from "../data/activityCodeTitles.json";

const TITLES: Record<string, string> = activityCodeTitles;

export function getActivityCodeTitle(code: string): string | undefined {
  const trimmed = code.trim();
  if (!trimmed) {
    return undefined;
  }
  return TITLES[trimmed];
}
