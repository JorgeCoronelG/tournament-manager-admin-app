import { PageQuery } from "../../core/http/paginated-resource";
import { UserStatus } from "../users/user.model";

/** Whether the team can play (banned teams stay in the league but cannot take part) */
export type TeamStatus = "active" | "banned";

export const TEAM_STATUSES: readonly TeamStatus[] = ["active", "banned"];

/** The delegate (manager) of a team, as the list returns them */
export interface TeamManager {
  /** The user's id */
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  user_code: string;
  photo_url: string | null;
  account_status: UserStatus;
}

/** A team of the active league, as the endpoints return it */
export interface Team {
  id: number;
  name: string;
  logo_url: string | null;
  status: TeamStatus;
  /** Null while the team has no delegate */
  manager: TeamManager | null;
  /** ISO 8601 date */
  created_at: string;
}

/** Data of a brand new delegate (they get an activation email) */
export interface NewManager {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

/**
 * Who the delegate is: a new user (`NewManager` fields) or an existing one,
 * found by their code
 */
export type ManagerInput = NewManager | { user_code: string };

/** Body of POST /teams; PUT /teams/{id} only takes the name */
export interface NewTeam {
  name: string;
  manager?: ManagerInput;
}

/** What GET /manager-lookup reveals about a delegate: never email or phone */
export interface ManagerLookup {
  user_id: number;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

export type TeamSortField = "name" | "created_at";

export interface TeamsFilters {
  /** Matches the team's name or its delegate's */
  search: string;
  status: TeamStatus | "";
  /** "none": only teams without a delegate; an id: only that delegate's */
  manager: "none" | number | "";
}

/** A delegate of the league's teams, as an option of the delegate filter */
export interface TeamManagerOption {
  id: number;
  first_name: string;
  last_name: string;
}

export type TeamsQuery = TeamsFilters & PageQuery;
