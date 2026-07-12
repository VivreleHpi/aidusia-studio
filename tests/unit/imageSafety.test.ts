import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, validateImageFile } from "@/lib/imageSafety";

describe("validateImageFile", () => {
  it("accepts a supported non-empty image", () => {
    expect(() => validateImageFile(new File(["image"], "photo.png", { type: "image/png" }), "en")).not.toThrow();
  });

  it("blocks active SVG content and oversized files", () => {
    expect(() => validateImageFile(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }), "en"))
      .toThrow(/Unsupported format/);
    const oversized = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "huge.jpg", { type: "image/jpeg" });
    expect(() => validateImageFile(oversized, "en")).toThrow(/smaller than 15 MB/);
  });
});
