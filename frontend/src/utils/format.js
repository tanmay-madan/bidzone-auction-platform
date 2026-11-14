export function formatINR(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

// Renders a countdown string purely for display. This value is never
// used to decide whether bidding is allowed — the backend is
// authoritative for that.
export function formatTimeRemaining(endsAt, now = Date.now()) {
  const diffMs = new Date(endsAt).getTime() - now;
  if (diffMs <= 0) return "Ended";

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  // Under an hour, show seconds so the live countdown visibly ticks.
  const seconds = Math.floor((diffMs % 60000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
