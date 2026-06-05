import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCountUp } from "./useCountUp";

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("useCountUp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns 0 while start=false", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useCountUp(500, { start: false }));
    expect(result.current).toBe(0);
  });

  it("returns target immediately when prefers-reduced-motion is set", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useCountUp(500, { start: true }));
    expect(result.current).toBe(500);
  });

  describe("with faked rAF", () => {
    let rafCallbacks: FrameRequestCallback[];

    beforeEach(() => {
      rafCallbacks = [];
      vi.stubGlobal(
        "requestAnimationFrame",
        vi.fn((cb: FrameRequestCallback) => {
          rafCallbacks.push(cb);
          return rafCallbacks.length;
        }),
      );
      vi.stubGlobal("cancelAnimationFrame", vi.fn());
      stubMatchMedia(false);
    });

    function flush(time: number) {
      const cbs = rafCallbacks;
      rafCallbacks = [];
      act(() => {
        for (const cb of cbs) {
          cb(time);
        }
      });
    }

    it("animates from 0 toward target across rAF frames", () => {
      const { result } = renderHook(() =>
        useCountUp(1000, { start: true, durationMs: 1000 }),
      );
      // first frame establishes start time (progress 0)
      flush(0);
      expect(result.current).toBe(0);
      // halfway through duration -> eased value between 0 and target
      flush(500);
      expect(result.current).toBeGreaterThan(0);
      expect(result.current).toBeLessThan(1000);
      // past the duration -> settles exactly at target
      flush(2000);
      expect(result.current).toBe(1000);
    });

    it("cancels the animation frame on unmount", () => {
      const { unmount } = renderHook(() =>
        useCountUp(1000, { start: true, durationMs: 1000 }),
      );
      flush(0);
      unmount();
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });
  });
});
