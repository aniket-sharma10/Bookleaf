// Book status is free text from the dataset ("Published & Live",
// "In Production - Typesetting"), stored verbatim. These helpers read it for
// display without changing the stored value.

const IN_PRODUCTION = /^in production\s*-\s*/i;

export function isInProduction(status: string): boolean {
  return status.toLowerCase().startsWith("in production");
}

/** "In Production - Cover Design" → "Cover Design"; otherwise null. */
export function productionStage(status: string): string | null {
  if (!isInProduction(status)) return null;
  const stage = status.replace(IN_PRODUCTION, "").trim();
  return stage && stage.toLowerCase() !== "in production" ? stage : null;
}
