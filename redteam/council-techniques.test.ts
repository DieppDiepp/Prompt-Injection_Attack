import { describe, expect, it } from "vitest";
import { prefixNoisyProbe, PRIORITY_NOISY_PREFIX } from "./council-techniques";

describe("priority noisy-prefix technique", () => {
  it("preserves the exact prefix and respects the complete probe limit", () => {
    const probe = prefixNoisyProbe("A natural request that follows the noisy prefix.", 80);

    expect(probe).toBe(`${PRIORITY_NOISY_PREFIX}\nA natural request that follows the noisy prefix.`);
    expect(probe.length).toBeLessThanOrEqual(80);
  });

  it("shortens only the natural follow-up when needed", () => {
    const probe = prefixNoisyProbe("x".repeat(500), 80);

    expect(probe.startsWith(`${PRIORITY_NOISY_PREFIX}\n`)).toBe(true);
    expect(probe.length).toBeLessThanOrEqual(80);
  });
});
