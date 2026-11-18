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
  /** ISO 8601 date */
  created_at: string;
}

/** Body of POST /leagues and PUT /leagues/{id} */
export interface NewLeague {
  name: string;
  admin_user_id: number;
}

export type LeagueSortField = "name" | "created_at";

export interface LeaguesFilters {
  search: string;
  adminUserId: number | "";
  status: LeagueStatus | "";
}

export type LeaguesQuery = LeaguesFilters & PageQuery;
