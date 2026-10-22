import { PageQuery } from "../../core/http/paginated-resource";
import { RosterPerson, RosterStatus } from "../rosters/roster.model";

export type PlayerGender = "male" | "female";

export const PLAYER_GENDERS: readonly PlayerGender[] = ["male", "female"];

/** A team the player is active in, with the tournament it plays there */
export interface PlayerTeam {
  team: string | null;
  tournament: string | null;
}

/** A player as the list shows them; never includes the email */
export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  user_code: string;
  gender: PlayerGender;
  /** Y-m-d */
  birth_date: string;
  age: number;
  phone: string | null;
  /** Banned in the active league */
  is_banned: boolean;
  active_teams: PlayerTeam[];
}

/** A roster row of the player in this league, whatever its status */
export interface PlayerRosterEntry {
  id: number;
  tournament: string | null;
  team: string | null;
  jersey_number: number;
  status: RosterStatus;
  /** ISO 8601 date */
  requested_at: string;
  removed_by: RosterPerson | null;
  /** ISO 8601 date */
  removed_at: string | null;
  removal_reason: string | null;
}

export interface PlayerBan {
  id: number;
  reason: string;
  banned_by: RosterPerson | null;
  /** ISO 8601 date */
  banned_at: string;
  lifted_by: RosterPerson | null;
  /** ISO 8601 date; null while the ban holds */
  lifted_at: string | null;
}

export interface PlayerDetail extends Player {
  rosters: PlayerRosterEntry[];
  bans: PlayerBan[];
}

/** What banning a player did to the rosters of the league */
export interface BanResult {
  player: Player;
  removed_rosters: number;
  cancelled_requests: number;
}

export interface PlayersFilters {
  /** Matches the player's name or code */
  search: string;
  gender: PlayerGender | "";
  status: "banned" | "not_banned" | "";
}

export type PlayersQuery = PlayersFilters & PageQuery;

export function fullName(player: Pick<Player, "first_name" | "last_name">) {
  return `${player.first_name} ${player.last_name}`.trim();
}

const BIRTH_DATE_FORMAT = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** `Y-m-d` as dd/mm/yyyy (es-MX), read as a local date so it does not shift a day */
export function formatBirthDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);

  return BIRTH_DATE_FORMAT.format(new Date(year, month - 1, day));
}
