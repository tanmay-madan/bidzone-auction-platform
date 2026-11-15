import { useEffect, useState } from "react";
import api from "../services/api";

// Pings the backend health-check endpoint so the UI visibly proves
// the frontend, backend and database are wired together.
export default function BackendStatus() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    api
      .get("/health")
      .then((res) => {
        if (!cancelled) setStatus(res.data?.database === "connected" ? "online" : "degraded");
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const config = {
    checking: { color: "bg-mute", text: "Checking API…" },
    online: { color: "bg-win", text: "API + PostgreSQL online" },
    degraded: { color: "bg-gold", text: "API up · database offline" },
    offline: { color: "bg-live", text: "API unreachable" },
  }[status];

  return (
    <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
      <span className="relative flex h-2 w-2">
        {status === "online" && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${config.color}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${config.color}`} />
      </span>
      {config.text}
    </div>
  );
}
