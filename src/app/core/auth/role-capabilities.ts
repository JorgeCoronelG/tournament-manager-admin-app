import { Role } from "./role.model";

export const CAPABILITIES = [
  "users.manage",
  "customers.manage",
  "leagues.manage",
  "tournaments.manage",
  "teams.manage",
  "players.manage",
  "referees.manage",
  "matches.manage",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * What each role can do in the web panel. The menu and the route guards read
 * from here. It only drives the UI: the backend authorizes every endpoint.
 */
export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  superadmin: CAPABILITIES,
  league_admin: [
    "tournaments.manage",
    "teams.manage",
    "players.manage",
    "referees.manage",
    "matches.manage",
  ],
  referee: [],
  manager: [],
  player: [],
};

/** A user can hold several roles: the result is the union of all of them */
export function capabilitiesFor(
  roles: readonly Role[],
): ReadonlySet<Capability> {
  return new Set(roles.flatMap((role) => ROLE_CAPABILITIES[role]));
}
