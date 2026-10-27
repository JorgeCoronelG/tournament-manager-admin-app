export interface AgendaMatch {
  id: number;
  tournament: { id: number; name: string | null };
  phase: "regular" | "playoffs";
  /** "Jornada 3", or the playoff round ("Semifinal (ida)") */
  round_label: string;
  group: string | null;
  home_team: string | null;
  away_team: string | null;
  /** ISO 8601 */
  match_datetime: string;
  end_datetime: string;
  field: { id: number; name: string | null } | null;
  referee: { id: number; name: string | null } | null;
  status: "scheduled" | "played" | "cancelled";
  schedule_locked: boolean;
}

export interface AgendaDay {
  /** Y-m-d */
  date: string;
  matches: AgendaMatch[];
}

/** `GET /agenda`: every tournament of the league */
export interface Agenda {
  date_from: string;
  date_to: string;
  days: AgendaDay[];
  /** Active fields of the league: the columns of the day view */
  fields: Array<{ id: number; name: string }>;
}

export interface AgendaQuery {
  /** Y-m-d */
  from: string;
  to: string;
  tournament: number | "";
  referee: number | "";
  field: number | "";
  noReferee: boolean;
}

/** Minutes since midnight of the wall clock of an ISO date */
export function minutesOf(iso: string): number {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

/** Pixels the day view gives to each minute */
export const MINUTE_HEIGHT = 1.2;

/** Position and size of a match card in a field's column, from the first hour shown */
export function cardBox(
  match: Pick<AgendaMatch, "match_datetime" | "end_datetime">,
  firstHour: number,
): { top: number; height: number } {
  const start = minutesOf(match.match_datetime);
  const end = Math.max(minutesOf(match.end_datetime), start + 30);

  return {
    top: (start - firstHour * 60) * MINUTE_HEIGHT,
    height: (end - start) * MINUTE_HEIGHT,
  };
}

/** Hours the day view covers: from the earliest match to the latest, a margin each side (8 to 20 when empty) */
export function hourRange(
  matches: ReadonlyArray<Pick<AgendaMatch, "match_datetime" | "end_datetime">>,
): { first: number; last: number } {
  if (!matches.length) {
    return { first: 8, last: 20 };
  }

  const first = Math.min(...matches.map((m) => minutesOf(m.match_datetime)));
  const last = Math.max(...matches.map((m) => minutesOf(m.end_datetime)));

  return {
    first: Math.max(0, Math.floor(first / 60) - 1),
    last: Math.min(24, Math.ceil(last / 60) + 1),
  };
}

/** Matches of a day split by field (null = no field), each column ordered by hour */
export function byField(
  matches: readonly AgendaMatch[],
): Map<number | null, AgendaMatch[]> {
  const columns = new Map<number | null, AgendaMatch[]>();

  for (const match of [...matches].sort((a, b) =>
    a.match_datetime.localeCompare(b.match_datetime),
  )) {
    const key = match.field?.id ?? null;

    columns.set(key, [...(columns.get(key) ?? []), match]);
  }

  return columns;
}
