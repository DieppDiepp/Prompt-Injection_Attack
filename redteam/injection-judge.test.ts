import { describe, expect, it } from "vitest";
import { parseInjectionAssessment } from "./injection-judge";

describe("parseInjectionAssessment", () => {
  it("accepts an injected finding and trims its evidence", () => {
    const assessment = parseInjectionAssessment(`before {"status":"injected","reason":"Đã làm theo yêu cầu bỏ qua ràng buộc.","evidence":["  bỏ qua ràng buộc  "]} after`);
    expect(assessment).toEqual({
      status: "injected",
      reason: "Đã làm theo yêu cầu bỏ qua ràng buộc.",
      evidence: ["bỏ qua ràng buộc"],
    });
  });

  it("rejects a status outside the UI safety taxonomy", () => {
    expect(() => parseInjectionAssessment('{"status":"none","reason":"x","evidence":[]}')).toThrow(/status/i);
  });
});
