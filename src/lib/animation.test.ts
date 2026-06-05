import { describe, expect, it } from "vitest";

import { easeOutCubic, interpolate, nextCarouselIndex } from "./animation";

describe("interpolate", () => {
  it("returns the endpoints at progress 0 and 1", () => {
    expect(interpolate(0, 100, 0)).toBe(0);
    expect(interpolate(0, 100, 1)).toBe(100);
    expect(interpolate(20, 80, 0)).toBe(20);
    expect(interpolate(20, 80, 1)).toBe(80);
  });

  it("interpolates linearly between the endpoints", () => {
    expect(interpolate(0, 100, 0.5)).toBe(50);
    expect(interpolate(20, 80, 0.5)).toBe(50);
    expect(interpolate(-100, 100, 0.25)).toBe(-50);
  });

  it("clamps progress below 0 and above 1", () => {
    expect(interpolate(0, 100, -0.5)).toBe(0);
    expect(interpolate(0, 100, -10)).toBe(0);
    expect(interpolate(0, 100, 1.5)).toBe(100);
    expect(interpolate(0, 100, 42)).toBe(100);
  });

  it("supports a descending range", () => {
    expect(interpolate(100, 0, 0.5)).toBe(50);
    expect(interpolate(100, 0, 0)).toBe(100);
    expect(interpolate(100, 0, 1)).toBe(0);
  });
});

describe("easeOutCubic", () => {
  it("maps the endpoints to themselves", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it("eases out: faster at the start, output exceeds linear input", () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    expect(easeOutCubic(0.1)).toBeGreaterThan(0.1);
  });

  it("is monotonically increasing across the unit interval", () => {
    let previous = easeOutCubic(0);

    for (let step = 1; step <= 10; step += 1) {
      const current = easeOutCubic(step / 10);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it("clamps inputs outside the unit interval", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe("nextCarouselIndex", () => {
  it("advances to the next index", () => {
    expect(nextCarouselIndex(0, 4)).toBe(1);
    expect(nextCarouselIndex(1, 4)).toBe(2);
    expect(nextCarouselIndex(2, 4)).toBe(3);
  });

  it("wraps from the last index back to the first", () => {
    expect(nextCarouselIndex(3, 4)).toBe(0);
    expect(nextCarouselIndex(0, 1)).toBe(0);
  });

  it("returns 0 for an empty or non-positive length", () => {
    expect(nextCarouselIndex(2, 0)).toBe(0);
    expect(nextCarouselIndex(2, -3)).toBe(0);
  });

  it("normalizes an out-of-range current index", () => {
    expect(nextCarouselIndex(-1, 4)).toBe(0);
    expect(nextCarouselIndex(10, 4)).toBe(0);
  });
});
