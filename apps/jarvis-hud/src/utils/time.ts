/** "6m ago" style stamp used across the memory, agent and event panels. */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Wall clock in HH:MM:SS, used by the activity log. */
export function clockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-GB', { hour12: false });
}
