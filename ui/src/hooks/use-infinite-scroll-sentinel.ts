"use client";

import { useEffect, useRef, type RefObject } from "react";

interface UseInfiniteScrollSentinelOptions {
  /** When false, the observer is not attached */
  enabled?: boolean;
  /** Prefetch before the sentinel enters the viewport */
  rootMargin?: string;
}

/**
 * Returns a ref to place at the end of a list. When it enters the viewport,
 * `onLoadMore` is called (caller should guard with hasNextPage / isFetching).
 */
export function useInfiniteScrollSentinel(
  onLoadMore: () => void,
  options: UseInfiniteScrollSentinelOptions = {},
): RefObject<HTMLDivElement | null> {
  const { enabled = true, rootMargin = "240px" } = options;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const node = sentinelRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          onLoadMoreRef.current();
        }
      },
      { root: null, rootMargin, threshold: 0 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return sentinelRef;
}
