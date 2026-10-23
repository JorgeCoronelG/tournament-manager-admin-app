import { RegistrationTeam } from "../registrations/registration.model";

export type GroupType = "regular_stage" | "playoff";

/** A team of a group: the registration's id and its team */
export interface GroupTeam {
  /** Registration id: the one assignments use */
  id: number;
  team: RegistrationTeam;
}

/** A slice of a regular group that feeds a playoff: positions `start` to `end` */
export interface PlayoffSource {
  id: number;
  source_group_id: number;
  source_group_name: string | null;
  position_start: number;
  position_end: number;
}

/** A round of a playoff with its date (Y-m-d), as the backend names it */
export interface RoundDetail {
  name: string;
  date: string | null;
}

/** A group as the list returns it; playoffs add dates, sources and rounds */
export interface Group {
  id: number;
  name: string;
  type: GroupType;
  teams_count: number;
  /** Y-m-d; playoffs only */
  start_date?: string | null;
  round_interval_days?: number;
  sources?: PlayoffSource[];
  total_teams?: number;
  rounds?: number;
  /** Y-m-d */
  final_date?: string | null;
  /** Y-m-d of each round, first round to the final */
  round_dates?: Array<string | null>;
  rounds_detail?: RoundDetail[];
  /** Playoffs only: false once the backend locks it; absent means editable */
  editable?: boolean;
}

export interface GroupsOverview {
  groups: Group[];
  unassigned: GroupTeam[];
  /** False when two or more playoffs end on different days */
  finals_aligned: boolean;
}

/** A regular group with its teams */
export interface RegularGroup extends Group {
  teams: GroupTeam[];
}

/** What the page shows: regular groups with their teams, playoffs and loose teams */
export interface GroupsView {
  regular: RegularGroup[];
  playoffs: Group[];
  unassigned: GroupTeam[];
  finalsAligned: boolean;
}

export interface PlayoffSourceBody {
  source_group_id: number;
  position_start: number;
  position_end: number;
}

/** Body of POST and PATCH /groups; a regular group only has a name */
export type GroupBody =
  | { name: string }
  | {
      name: string;
      type: "playoff";
      /** Y-m-d */
      start_date: string | null;
      round_interval_days: number;
      /** Y-m-d per round; only sent when the admin edited one by hand */
      round_dates?: string[] | null;
      sources: PlayoffSourceBody[];
    };

export interface GroupAssignment {
  registration_id: number;
  group_id: number | null;
}

export const DEFAULT_ROUND_INTERVAL_DAYS = 7;

/** Teams a playoff takes from its sources */
export function playoffTotal(
  sources: ReadonlyArray<{
    position_start: number | null;
    position_end: number | null;
  }>,
): number {
  return sources.reduce((total, { position_start, position_end }) => {
    if (
      position_start === null ||
      position_end === null ||
      !Number.isInteger(position_start) ||
      !Number.isInteger(position_end) ||
      position_start < 1 ||
      position_end < position_start
    ) {
      return total;
    }

    return total + position_end - position_start + 1;
  }, 0);
}

/** A playoff needs 2, 4, 8, 16, 32... teams */
export function isValidPlayoffTotal(total: number): boolean {
  return total >= 2 && (total & (total - 1)) === 0;
}

/** Teams that play each round, first round to the final: 8 → [8, 4, 2] */
export function playoffRounds(total: number): number[] {
  const rounds: number[] = [];

  for (let teams = total; isValidPlayoffTotal(teams); teams = teams / 2) {
    rounds.push(teams);
  }

  return rounds;
}

/** Translation key and params of a round's name, by the teams that play it */
export function roundLabel(teams: number): {
  key: string;
  params: { teams: number };
} {
  const known = [2, 4, 8, 16].includes(teams);

  return { key: `groups.round.${known ? teams : "other"}`, params: { teams } };
}

/** A date moved by whole days, in local time */
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * The date of each round counted from the first one: start, start + interval,
 * and so on. Without a start date, or with an invalid interval, the rounds
 * that depend on them have no date.
 */
export function autoRoundDates(
  start: Date | null,
  interval: number | null,
  count: number,
): Array<Date | null> {
  const valid =
    interval !== null && Number.isInteger(interval) && interval >= 1;

  return Array.from({ length: count }, (_, index) => {
    if (!start) {
      return null;
    }

    if (index === 0) {
      return start;
    }

    return valid ? addDays(start, interval * index) : null;
  });
}

/** True when every date that is set is later than the one before it */
export function datesInOrder(dates: ReadonlyArray<Date | null>): boolean {
  let previous: number | null = null;

  for (const date of dates) {
    if (!date) {
      continue;
    }

    const time = date.getTime();

    if (previous !== null && time <= previous) {
      return false;
    }

    previous = time;
  }

  return true;
}
