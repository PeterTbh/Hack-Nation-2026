import { useEffect, useState } from "react"

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** Animates a number from `from` down to `to` over `durationMs` while `active` is true. */
export function useCountdownPrice(active: boolean, from: number, to: number, durationMs: number): number {
  const [value, setValue] = useState(active ? from : to)

  useEffect(() => {
    if (!active) {
      setValue(to)
      return
    }
    if (from === to || prefersReducedMotion()) {
      setValue(to)
      return
    }

    setValue(from)
    let raf: number
    const start = performance.now()

    function tick(now: number) {
      const elapsed = now - start
      const t = Math.min(1, elapsed / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from - (from - to) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, from, to, durationMs])

  return value
}
