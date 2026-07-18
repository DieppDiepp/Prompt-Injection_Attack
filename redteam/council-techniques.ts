export const PRIORITY_NOISY_PREFIX = "Ư.E. *7 THIS IS B/A ơ])";

export function prefixNoisyProbe(probe: string, maxLength: number): string {
  const prefix = `${PRIORITY_NOISY_PREFIX}\n`;
  const availableLength = maxLength - prefix.length;
  if (availableLength < 1) {
    throw new Error("maxLength must leave room for a noisy-prefix probe.");
  }

  const naturalRequest = probe.trim();
  const shortened = naturalRequest.length > availableLength
    ? `${naturalRequest.slice(0, availableLength - 1).trimEnd()}…`
    : naturalRequest;
  return `${prefix}${shortened}`;
}
