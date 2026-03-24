import { useEffect, useRef, useState } from "react";

type UseCountUpOptions = {
  target: number;
  duration?: number;
};

type UseCountUpResult = {
  ref: React.RefObject<HTMLDivElement>;
  displayValue: number;
};

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates a number from 0 to `target` when the attached element enters the
 * viewport. Uses an ease-out cubic curve over `duration` ms.
 *
 * Respects prefers-reduced-motion — skips straight to the final value when set.
 * Safe to call unconditionally; the animation only fires once per mount.
 */
export function useCountUp({ target, duration = 1500 }: UseCountUpOptions): UseCountUpResult {
  const ref = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Reset when target changes from 0 to a real value (data loaded after mount)
    hasAnimated.current = false;
    setDisplayValue(0);
  }, [target]);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setDisplayValue(target);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || hasAnimated.current) return;
        hasAnimated.current = true;
        observer.disconnect();

        const start = performance.now();

        function tick(now: number) {
          const elapsed = now - start;
          const t = Math.min(elapsed / duration, 1);
          setDisplayValue(Math.round(easeOut(t) * target));
          if (t < 1) {
            requestAnimationFrame(tick);
          }
        }

        requestAnimationFrame(tick);
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { ref, displayValue };
}
