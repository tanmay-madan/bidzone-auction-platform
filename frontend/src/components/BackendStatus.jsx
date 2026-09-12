import { useEffect, useState } from "react";
import api from "../services/api";

// Pings the backend health-check endpoint so Phase 1 visibly proves
// the frontend and backend are wired together, without any real
// feature logic behind it yet.
export default function BackendStatus() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    api
      .get("/health")
      .then(() => {
        if (!cancelled) setStatus("online");
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const config = {
    checking: { color: "bg-slate-light", text: "Checking backend..." },
    online: { color: "bg-success", text: "Backend connected" },
    offline: { color: "bg-[#B4463F]", text: "Backend unreachable" },
  }[status];

  return (
    <div className="inline-flex items-center gap-2 text-xs text-slate">
      <span className={`h-2 w-2 rounded-full ${config.color}`} />
      {config.text}
    </div>
  );
}
