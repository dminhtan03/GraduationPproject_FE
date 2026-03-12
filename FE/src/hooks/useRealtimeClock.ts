import { useEffect, useState } from "react";

export const useRealtimeClock = (intervalMs = 30_000) => {
  const [clockTick, setClockTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick(Date.now());
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return clockTick;
};
