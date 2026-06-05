"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseInViewOptions = {
  once?: boolean;
  rootMargin?: string;
};

/**
 * IntersectionObserver 기반 inView 감지.
 * - [refCallback, inView] 반환. refCallback을 관찰 대상 엘리먼트에 연결.
 * - once=true 면 한 번 보인 뒤 계속 true 유지.
 * - SSR / 미지원 환경에서는 안전하게 inView=true 로 폴백(모션 없이 콘텐츠 노출).
 */
export function useInView(
  opts: UseInViewOptions = {},
): readonly [(el: Element | null) => void, boolean] {
  const { once = true, rootMargin } = opts;
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const disconnect = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  const observe = useCallback(
    (el: Element) => {
      if (
        typeof window === "undefined" ||
        typeof IntersectionObserver === "undefined"
      ) {
        // SSR / 미지원: 모션 없이 콘텐츠를 보이게 하는 안전 폴백.
        setInView(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) {
            return;
          }
          if (entry.isIntersecting) {
            setInView(true);
            if (once) {
              disconnect();
            }
          } else if (!once) {
            setInView(false);
          }
        },
        { rootMargin },
      );
      observer.observe(el);
      observerRef.current = observer;
    },
    [once, rootMargin, disconnect],
  );

  const refCallback = useCallback(
    (el: Element | null) => {
      disconnect();
      if (el) {
        observe(el);
      }
    },
    [observe, disconnect],
  );

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return [refCallback, inView] as const;
}
