import { PageQuery } from "../../core/http/paginated-resource";
import { UserStatus } from "../users/user.model";

/** The league's manager, as the leagues endpoints embed it */
export interface LeagueAdmin {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: UserStatus;
}

export type LeagueStatus = "active" | "inactive";

export interface League {
  id: number;
  name: string;
  admin: LeagueAdmin;
  status: LeagueStatus;
  is_active: boolean;
  /** Tournaments in progress or in their playoffs at once; null for no limit */
  max_active_tournaments: number | null;
  /** Not used by the interface */
  max_teams_per_tournament?: number | null;
  /** ISO 8601 date */
  created_at: string;
}

/** Body of POST /leagues and PUT /leagues/{id} */
export interface NewLeague {
  name: string;
  admin_user_id: number;
  max_active_tournaments: number | null;
}

/** `GET /leagues/{id}/limits`: the limits and what the league uses of them */
export interface LeagueLimits {
  max_active_tournaments: number | null;
  usage: {
    /** Tournaments in progress or in their playoffs (planning ones do not count) */
    active_tournaments: number;
    tournaments: Array<{
      id: number;
      name: string;
      status: string;
      active_registrations: number;
    }>;
  };
}

/** A new tournament cannot start: the league already has all the active ones it may */
export function tournamentsReached(limits: LeagueLimits): boolean {
  return (
    limits.max_active_tournaments !== null &&
    limits.usage.active_tournaments >= limits.max_active_tournaments
  );
}

/** The usage is over the limit being set (it was lowered below what the league has) */
export function exceedsLimit(
  usage: LeagueLimits["usage"],
  maxTournaments: number | null,
): boolean {
  return maxTournaments !== null && usage.active_tournaments > maxTournaments;
}

export interface LeaguesFilters {
  search: string;
  adminUserId: number | "";
  status: LeagueStatus | "";
}

export type LeaguesQuery = LeaguesFilters & PageQuery;
