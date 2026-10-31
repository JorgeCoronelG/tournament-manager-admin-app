import { PageQuery } from "../../core/http/paginated-resource";
import { TeamStatus } from "../teams/team.model";
/** A team as the registrations endpoints show it; no delegate means null */
export interface RegistrationTeam {
  id: number;
  name: string;
  logo_url: string | null;
  manager: { name: string; pending: boolean } | null;
  /** Banned teams stay enrolled but do not count to start the tournament */
  status?: TeamStatus;
}

/** A team enrolled in a tournament, as the list returns it */
export interface Registration {
  id: number;
  status: "active" | "withdrawn";
  team: RegistrationTeam;
  /** Regular group of the team, whatever its status; null when it has none */
  group?: { id: number; name: string } | null;
  /** ISO 8601 date */
  created_at: string;
  /** ISO 8601 date; null while the team is in the tournament */
  withdrawn_at?: string | null;
  withdrawn_reason?: string | null;
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
export type AvailableTeam = RegistrationTeam;

export function isBanned(team: RegistrationTeam): boolean {
  return team.status === "banned";
}

export function isWithdrawn(registration: Pick<Registration, "status">) {
  return registration.status === "withdrawn";
}

/** A pending match of a team about to be withdrawn */
export interface WithdrawMatch {
  match_id: number;
  /** "Jornada 3", "Semifinal (ida)" */
  round_label: string;
  group: string | null;
  rival: string | null;
  /** Y-m-d; null while it has no date */
  date: string | null;
}

/** What withdrawing a team would do (GET .../withdraw/preview) */
export interface WithdrawPreview {
  kept_played: number;
  /** Pending matches: they stay as they are, to be settled one by one or taken by a replacement */
  pending_matches: number;
  players_released: number;
  warnings: string[];
}

/** What withdrawing a team did */
export interface WithdrawResult {
  kept_played: number;
  pending_matches: number;
  players_released: number;
  registration: Registration;
}

export interface ReplaceResult {
  registration: Registration;
  warnings: string[];
}

/** Reason the backend asks for when withdrawing or replacing a team */
export const REASON_MIN = 5;
export const REASON_MAX = 255;

/** A time the team of a registration was replaced (GET .../team-changes) */
export interface TeamChange {
  id: number;
  old_team: { id: number; name: string };
  new_team: { id: number; name: string };
  reason: string;
  /** Who replaced it; null when that user no longer exists */
  changed_by: { id: number; name: string } | null;
  /** ISO 8601 date */
  created_at: string;
}
