import { PageQuery } from "../../core/http/paginated-resource";

export type RosterStatus =
  "pending" | "active" | "rejected" | "cancelled" | "removed";

export const ROSTER_STATUSES: readonly RosterStatus[] = [
  "pending",
  "active",
  "rejected",
  "cancelled",
  "removed",
];

/** Who did something, as the roster rows show it */
export interface RosterPerson {
  id: number;
  name: string;
}

export interface RosterPlayer {
  id: number;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  user_code: string;
}

/** A row of a team's roster in a tournament */
export interface RosterEntry {
  id: number;
  player: RosterPlayer;
  jersey_number: number;
  status: RosterStatus;
  /** ISO 8601 date */
  requested_at: string;
  requested_by: RosterPerson | null;
  removed_by: RosterPerson | null;
  /** ISO 8601 date */
  removed_at: string | null;
  removal_reason: string | null;
  /** ISO 8601 date; set while a removed player may join another team */
  rejoin_authorized_at: string | null;
}

export interface RosterFilters {
  /** Matches the player's name or code */
  search: string;
  status: RosterStatus | "";
}

export type RostersQuery = RosterFilters & PageQuery;

export function playerName(player: RosterPlayer): string {
  return `${player.first_name} ${player.last_name}`.trim();
}
