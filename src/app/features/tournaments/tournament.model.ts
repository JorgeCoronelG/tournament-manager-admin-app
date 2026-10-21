import { PageQuery } from "../../core/http/paginated-resource";

export type TournamentGender = "male" | "female" | "mixed";

export type TournamentStatus = "planning" | "in_progress" | "finished";

export const TOURNAMENT_GENDERS: readonly TournamentGender[] = [
  "male",
  "female",
  "mixed",
];

export const TOURNAMENT_STATUSES: readonly TournamentStatus[] = [
  "planning",
  "in_progress",
  "finished",
];

/** Ages the backend accepts */
export const MIN_AGE = 18;
export const MAX_AGE = 99;

export interface Tournament {
  id: number;
  league_id: number;
  name: string;
  gender: TournamentGender;
  min_age: number | null;
  max_age: number | null;
  /** Y-m-d */
  start_date: string;
  max_roster_size: number | null;
  min_matches_for_playoffs: number | null;
  status: TournamentStatus;
  /** ISO 8601 date */
  created_at: string;
}

/** Body of POST and PUT /tournaments; the status changes with PATCH /status */
export interface NewTournament {
  name: string;
  gender: TournamentGender;
  min_age: number | null;
  max_age: number | null;
  /** Y-m-d */
  start_date: string;
  max_roster_size: number | null;
  min_matches_for_playoffs: number | null;
}

export type TournamentSortField = "name" | "start_date" | "created_at";

export interface TournamentsFilters {
  search: string;
  gender: TournamentGender | "";
  status: TournamentStatus | "";
}

export type TournamentsQuery = TournamentsFilters & PageQuery;

/** `Y-m-d` to a local date (`new Date("2026-03-01")` would be UTC and shift a day) */
export function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

/** A local date to `Y-m-d` */
export function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}
