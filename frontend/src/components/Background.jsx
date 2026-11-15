import { useEffect } from "react";

// Animated aurora blobs + film grain behind every page, and one global
// pointer listener that feeds the cursor position to any `.spotlight`
// element (cards, panels) for the hover glow.
export default function Background() {
  useEffect(() => {
    function onMove(e) {
      const el = e.target?.closest?.(".spotlight");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className="aurora" aria-hidden="true">
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="grain" />
    </div>
  );
}
