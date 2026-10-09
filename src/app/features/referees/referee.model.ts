import { PageQuery } from "../../core/http/paginated-resource";
import { UserStatus } from "../users/user.model";

/** Whether the referee is active in the league (not the state of their account) */
export type RefereeLeagueStatus = "active" | "inactive";

export const REFEREE_LEAGUE_STATUSES: readonly RefereeLeagueStatus[] = [
  "active",
  "inactive",
];

/** A referee of the active league, as the endpoints return it */
export interface Referee {
  /** The user's id */
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  user_code: string;
  photo_url: string | null;
  account_status: UserStatus;
  /** Status in this league */
  status: RefereeLeagueStatus;
  /** ISO 8601 date */
  created_at: string;
}

/** Body of POST /referees; PUT /referees/{id} takes the same fields */
export interface NewReferee {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

/** What GET /referees/lookup reveals about a referee: never email or phone */
export interface RefereeLookup {
  user_id: number;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  already_in_league: boolean;
}

export type RefereeSortField = "first_name" | "last_name" | "created_at";

export interface RefereesFilters {
  search: string;
  status: RefereeLeagueStatus | "";
}

export type RefereesQuery = RefereesFilters & PageQuery;
