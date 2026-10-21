import { PageQuery } from "../../core/http/paginated-resource";
import { TeamStatus } from "../teams/team.model";
/** A team as the registrations endpoints show it; no delegate means null */
export interface RegistrationTeam {
  id: number;
  name: string;
  logo_url: string | null;
  manager: { name: string; pending: boolean } | null;
}

/** A team enrolled in a tournament, as the list returns it */
export interface Registration {
  id: number;
  status: "active" | "withdrawn";
  team: RegistrationTeam;
  /** ISO 8601 date */
  created_at: string;
}

export interface RegistrationsFilters {
  /** Matches the team's name or its delegate's */
  search: string;
}

export type RegistrationsQuery = RegistrationsFilters & PageQuery;

/**
 * A team of the league that is not enrolled yet, as the dialog lists it.
 * Banned teams come too, so the dialog can show them disabled.
 */
export interface AvailableTeam extends RegistrationTeam {
  status?: TeamStatus;
}

export function isBanned(team: AvailableTeam): boolean {
  return team.status === "banned";
}
