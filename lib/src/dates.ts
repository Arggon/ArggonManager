/** v0 dates are quoted YYYY-MM-DD (UTC calendar day). */
export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
/** Claim leases are ISO date-time stamps (UTC), e.g. 2026-09-11T12:00:00.000Z. */
export function formatDateTime(d: Date): string {
  return d.toISOString();
}
