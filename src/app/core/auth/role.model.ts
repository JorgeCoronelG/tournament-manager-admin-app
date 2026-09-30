/** Role names exactly as the backend `roles` table stores them */
export const ROLES = [
  "superadmin",
  "league_admin",
  "referee",
  "manager",
  "player",
] as const;

export type Role = (typeof ROLES)[number];

/** Keeps only the roles this app knows about, so an unexpected value never grants anything */
export function toRoles(values: readonly string[] | undefined): Role[] {
  const known: readonly string[] = ROLES;

  return (values ?? []).filter((value): value is Role => known.includes(value));
}
