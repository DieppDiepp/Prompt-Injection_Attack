import { afterEach, describe, expect, it, vi } from "vitest";
import { askDeepSeek, REDTEAM_COUNCIL_MODEL } from "./openai";

const originalKey = process.env.DEEPSEEK_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalKey;
});

describe("DeepSeek council client", () => {
  it("uses V4 Flash through Chat Completions with thinking disabled", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: " concise result " } }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(askDeepSeek({
      instructions: "Council instruction",
      input: "Council input",
      maxOutputTokens: 123,
    })).resolves.toBe("concise result");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: REDTEAM_COUNCIL_MODEL,
          messages: [
            { role: "system", content: "Council instruction" },
            { role: "user", content: "Council input" },
          ],
          max_tokens: 123,
          thinking: { type: "disabled" },
          stream: false,
        }),
      }),
    );
  });
});
