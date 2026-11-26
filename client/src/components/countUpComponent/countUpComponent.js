import React, { useState, useEffect } from "react";

function CountUpComponent({ targetNumber }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(targetNumber)) return undefined;
    // Phone dashboards display the result immediately. Desktop animation has a
    // fixed duration, regardless of whether a counter is 5 or 5,000,000.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce), (pointer: coarse)').matches || !targetNumber) {
      setCount(targetNumber);
      return undefined;
    }
    let frameId;
    const started = performance.now();
    const frame = now => {
      const progress = Math.max(0, Math.min(1, (now - started) / 450));
      setCount(Math.round(targetNumber * progress));
      if (progress < 1) frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [targetNumber]);

  return <span>{typeof targetNumber === "number" ? count : targetNumber}</span>;
}

export default CountUpComponent;
