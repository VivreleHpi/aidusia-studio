import { describe, expect, it } from "vitest";
import { inferVisionCapable, openAiUserContent } from "@/lib/visionPayload";

describe("visionPayload", () => {
  it("detects vision models by id heuristic", () => {
    expect(inferVisionCapable("gpt-4o-mini")).toBe(true);
    expect(inferVisionCapable("llama3.2")).toBe(false);
  });

  it("builds openai multimodal content", () => {
    const content = openAiUserContent({ role: "user", content: "hi", images: ["abc"] });
    expect(Array.isArray(content)).toBe(true);
    expect(content).toHaveLength(2);
  });
});
