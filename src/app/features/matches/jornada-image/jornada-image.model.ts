import { Match, Matchday } from "../match.model";
import { slotParts } from "../schedule.model";
import { slug } from "../standings-export/standings-image.model";

/** A tag next to the score: a match that was moved or called off */
export type JornadaMatchTag = "rescheduled" | "cancelled";

export interface JornadaImageTeam {
  name: string;
  logo_url: string | null;
}

/** A match of the image; a null date, time, field or referee is shown as "Por definir" / "Sin asignar" */
export interface JornadaImageMatch {
  home: JornadaImageTeam;
  away: JornadaImageTeam;
  tag: JornadaMatchTag | null;
  referee: string | null;
  /** "Sáb 28/11/2026" */
  day: string | null;
  /** "8:00 a.m." */
  time: string | null;
  field: string | null;
}

/** Everything the exported image of a matchday shows */
export interface JornadaImageData {
  leagueName: string;
  tournamentName: string;
  /** "Jornada 3", or "Jornada 3 · Grupo A" when the tournament has several groups */
  title: string;
  /** "Fase regular" */
  phase: string;
  /** "28/11/2026 – 29/11/2026", one date for a single day; null when no match has a date */
  dates: string | null;
  matches: JornadaImageMatch[];
}

export const fullDate = (iso: string): string => {
  const [year, month, day] = iso.slice(0, 10).split("-");

  return `${day}/${month}/${year}`;
};

/** First and last day of the matches that have a date, as dd/MM/yyyy */
export function fullDatesRange(
  matches: ReadonlyArray<{ match_datetime: string | null }>,
): string | null {
  const dates = matches
    .map((match) => match.match_datetime)
    .filter((date): date is string => !!date)
    .sort();

  if (!dates.length) {
    return null;
  }

  const first = fullDate(dates[0]);
  const last = fullDate(dates[dates.length - 1]);

  return first === last ? first : `${first} – ${last}`;
}

/** calendario-jornada-{n}[-{grupo}]-{torneo}.png */
export function jornadaFileName(
  matchday: number,
  groupName: string | null,
  tournamentName: string,
  prefix = "calendario-jornada",
): string {
  return `${[
    prefix,
    String(matchday),
    groupName ? slug(groupName) : "",
    slug(tournamentName),
  ]
    .filter(Boolean)
    .join("-")}.png`;
}

function tagOf(match: Match): JornadaMatchTag | null {
  if (match.status === "cancelled") {
    return "cancelled";
  }

  return match.original_match_datetime ? "rescheduled" : null;
}

/** The data of the image of a matchday, as the calendar shows it */
export function buildJornadaImageData(input: {
  leagueName: string;
  tournamentName: string;
  day: Matchday;
  /** The group's name; only given when the tournament has several groups */
  groupName: string | null;
  phase: string;
  matchdayLabel: (matchday: number) => string;
  /** Full name of an ISO weekday (1 = Monday) */
  weekdayName: (weekday: number) => string;
}): JornadaImageData {
  const team = (side: Match["home"]): JornadaImageTeam => ({
    name: side?.team_name ?? "—",
    logo_url: side?.logo_url ?? null,
  });

  return {
    leagueName: input.leagueName,
    tournamentName: input.tournamentName,
    title: [input.matchdayLabel(input.day.matchday), input.groupName]
      .filter(Boolean)
      .join(" · "),
    phase: input.phase,
    dates: fullDatesRange(input.day.matches),
    matches: input.day.matches.map((match) => {
      const slot = match.match_datetime
        ? slotParts(match.match_datetime)
        : null;

      return {
        home: team(match.home),
        away: team(match.away),
        tag: tagOf(match),
        referee: match.referee?.name || null,
        day:
          slot && match.match_datetime
            ? `${input.weekdayName(slot.weekday).slice(0, 3)} ${fullDate(match.match_datetime)}`
            : null,
        time: slot?.time ?? null,
        field: match.field?.name || null,
      };
    }),
  };
}

/** resultados-jornada-{n}[-{grupo}]-{torneo}.png */
export function resultsFileName(
  matchday: number,
  groupName: string | null,
  tournamentName: string,
): string {
  return jornadaFileName(
    matchday,
    groupName,
    tournamentName,
    "resultados-jornada",
  );
}

/** The matchday has at least one match with a result */
export function hasResults(
  matches: ReadonlyArray<Pick<Match, "status">>,
): boolean {
  return matches.some((match) => match.status === "played");
}

/** What the middle of a row of the results image shows */
export type ResultsOutcome =
  | { kind: "score"; home: number; away: number }
  | { kind: "tag"; tag: JornadaMatchTag }
  | { kind: "none" };

export interface ResultsImageMatch {
  home: JornadaImageTeam;
  away: JornadaImageTeam;
  referee: string | null;
  outcome: ResultsOutcome;
  /** Who is highlighted; nobody on a draw or without a score */
  winner: "home" | "away" | null;
}

/** Everything the exported results image of a matchday shows */
export interface ResultsImageData {
  leagueName: string;
  tournamentName: string;
  /** "Resultados" */
  title: string;
  /** "Jornada 3", in the accent colour */
  matchday: string;
  /** "Fase regular", or "Fase regular · Grupo A" with several groups */
  subtitle: string;
  matches: ResultsImageMatch[];
}

function outcomeOf(match: Match): ResultsOutcome {
  if (match.status === "cancelled") {
    return { kind: "tag", tag: "cancelled" };
  }

  if (
    match.status === "played" &&
    match.home_score != null &&
    match.away_score != null
  ) {
    return { kind: "score", home: match.home_score, away: match.away_score };
  }

  return match.original_match_datetime
    ? { kind: "tag", tag: "rescheduled" }
    : { kind: "none" };
}

/** The data of the results image of a matchday */
export function buildResultsImageData(input: {
  leagueName: string;
  tournamentName: string;
  day: Matchday;
  /** The group's name; only given when the tournament has several groups */
  groupName: string | null;
  phase: string;
  title: string;
  matchdayLabel: (matchday: number) => string;
}): ResultsImageData {
  const team = (side: Match["home"]): JornadaImageTeam => ({
    name: side?.team_name ?? "—",
    logo_url: side?.logo_url ?? null,
  });

  return {
    leagueName: input.leagueName,
    tournamentName: input.tournamentName,
    title: input.title,
    matchday: input.matchdayLabel(input.day.matchday),
    subtitle: [input.phase, input.groupName].filter(Boolean).join(" · "),
    matches: input.day.matches.map((match) => {
      const outcome = outcomeOf(match);
      const winner =
        outcome.kind !== "score" || outcome.home === outcome.away
          ? null
          : outcome.home > outcome.away
            ? "home"
            : "away";

      return {
        home: team(match.home),
        away: team(match.away),
        referee: match.referee?.name || null,
        outcome,
        winner,
      };
    }),
  };
}
