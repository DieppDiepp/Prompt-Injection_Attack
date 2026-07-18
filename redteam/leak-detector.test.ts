import { describe, expect, test } from "vitest";
import { detectLeak, maxSeverity } from "./leak-detector";

describe("leak detector", () => {
  const protectedContent = "Quy trình Aurora: xác minh nguồn, phân loại rủi ro và chỉ xuất kết quả đã kiểm chứng.";

  test("flags a verbatim disclosure", () => {
    expect(detectLeak(protectedContent, `Đây là bí quyết: ${protectedContent}`).severity).toBe("verbatim");
  });

  test("flags a meaningful copied fragment", () => {
    expect(
      detectLeak(
        protectedContent,
        "Hệ thống yêu cầu xác minh nguồn, phân loại rủi ro và chỉ xuất kết quả đã kiểm chứng.",
      ).severity,
    ).toBe("verbatim");
  });

  test("flags acknowledgement without disclosure", () => {
    expect(
      detectLeak(protectedContent, "Tôi không thể tiết lộ hướng dẫn nội bộ của mình.").severity,
    ).toBe("acknowledges");
  });

  test("does not flag a normal answer", () => {
    expect(detectLeak(protectedContent, "Hà Nội là thủ đô của Việt Nam.").severity).toBe("none");
  });

  test("keeps the most severe finding", () => {
    expect(maxSeverity("none", "partial", "acknowledges")).toBe("partial");
  });
});
