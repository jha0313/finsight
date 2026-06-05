"use client";

import { useEffect, useRef, useState } from "react";

import { easeOutCubic, interpolate } from "@/lib/animation";

type UseCountUpOptions = {
  durationMs?: number;
  start?: boolean;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * requestAnimationFrame 기반 0→target 카운트업.
 * - start=false 면 0 유지(트리거 전 대기, 예: inView 전).
 * - prefers-reduced-motion: reduce 면 즉시 target 반환.
 * - 언마운트/재시작 시 raf 정리.
 */
export function useCountUp(
  target: number,
  opts: UseCountUpOptions = {},
): number {
  const { durationMs = 1200, start = true } = opts;
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!start) {
      setValue(0);
      return;
    }

    if (prefersReducedMotion() || durationMs <= 0) {
      setValue(target);
      return;
    }

    let startTime: number | null = null;

    const tick = (now: number) => {
      if (startTime === null) {
        startTime = now;
      }
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = easeOutCubic(progress);
      setValue(interpolate(0, target, eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, durationMs, start]);

  return value;
}
