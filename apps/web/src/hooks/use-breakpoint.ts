"use client";

import { useEffect, useState } from "react";

// Returns true if the viewport is narrower than `cssPx`. SSR-safe — starts
// at `false` and updates on mount.
export const useIsBelow = (cssPx: number): boolean => {
  const [below, setBelow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${cssPx - 1}px)`);
    const update = () => setBelow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [cssPx]);
  return below;
};
