import { useEffect, useState } from 'react';

/** Ticking wall clock for the header. */
export function useClock(): { time: string; date: string } {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return {
    time: now.toLocaleTimeString('en-GB', { hour12: false }),
    date: now
      .toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
      .toUpperCase(),
  };
}
