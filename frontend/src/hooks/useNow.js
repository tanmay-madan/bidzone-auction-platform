import { useEffect, useState } from "react";

// Re-renders the calling component every `intervalMs` so countdowns
// tick live. Display only — the backend's database clock is the sole
// authority on whether an auction is still open.
export default function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
