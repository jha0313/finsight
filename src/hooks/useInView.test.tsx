import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useInView } from "./useInView";

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

function installIntersectionObserver() {
  const instances: Array<{
    cb: ObserverCallback;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    trigger: (isIntersecting: boolean) => void;
  }> = [];

  class FakeIO {
    cb: ObserverCallback;
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(cb: ObserverCallback) {
      this.cb = cb;
      instances.push({
        cb,
        observe: this.observe,
        disconnect: this.disconnect,
        trigger: (isIntersecting: boolean) =>
          act(() => cb([{ isIntersecting }])),
      });
    }
    unobserve = vi.fn();
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = "";
    thresholds = [];
  }

  vi.stubGlobal("IntersectionObserver", FakeIO as unknown as typeof IntersectionObserver);
  return instances;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useInView", () => {
  it("starts not in view", () => {
    installIntersectionObserver();
    const { result } = renderHook(() => useInView());
    expect(result.current[1]).toBe(false);
  });

  it("becomes in view when the observed element intersects", () => {
    const instances = installIntersectionObserver();
    const { result } = renderHook(() => useInView());

    act(() => {
      result.current[0](document.createElement("div"));
    });
    expect(instances).toHaveLength(1);
    expect(instances[0].observe).toHaveBeenCalledTimes(1);

    instances[0].trigger(true);
    expect(result.current[1]).toBe(true);
  });

  it("stays in view after first intersection when once=true (default)", () => {
    const instances = installIntersectionObserver();
    const { result } = renderHook(() => useInView());

    act(() => {
      result.current[0](document.createElement("div"));
    });
    instances[0].trigger(true);
    expect(result.current[1]).toBe(true);
    // once=true disconnects after first hit
    expect(instances[0].disconnect).toHaveBeenCalled();
  });

  it("toggles back to false when leaving view if once=false", () => {
    const instances = installIntersectionObserver();
    const { result } = renderHook(() => useInView({ once: false }));

    act(() => {
      result.current[0](document.createElement("div"));
    });
    instances[0].trigger(true);
    expect(result.current[1]).toBe(true);
    instances[0].trigger(false);
    expect(result.current[1]).toBe(false);
  });

  it("disconnects the observer on unmount", () => {
    const instances = installIntersectionObserver();
    const { result, unmount } = renderHook(() => useInView());
    act(() => {
      result.current[0](document.createElement("div"));
    });
    unmount();
    expect(instances[0].disconnect).toHaveBeenCalled();
  });
});
