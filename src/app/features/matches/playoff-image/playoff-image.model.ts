import {
  BracketMatch,
  BracketPlayoff,
  BracketRound,
  BracketTeam,
  BracketTie,
} from "../playoff.model";
import { slotParts } from "../schedule.model";
import { slug } from "../standings-export/standings-image.model";
import {
  fullDate,
  fullDatesRange,
  JornadaMatchTag,
} from "../jornada-image/jornada-image.model";

/** The leg(s) an image of a home-and-away round shows */
export type LegChoice = "first" | "second" | "both";

/** A team of a tie: a defined one, or the text of the tie that feeds it ("Ganador semifinal 2") */
export interface PlayoffTeam {
  name: string;
  logo_url: string | null;
  seed: number | null;
  registration_id: number | null;
}

/** What each image of a round needs besides the bracket */
export interface PlayoffImageInput {
  leagueName: string;
  tournamentName: string;
  /** All the liguillas of the tournament: a name is shown only with several */
  playoffsCount: number;
  playoff: BracketPlayoff;
  round: BracketRound;
  choice: LegChoice;
  texts: {
    liguilla: string;
    first: string;
    second: string;
    both: string;
    tbd: string;
    winnerOf: (round: string, n: number) => string;
  };
}

/** Which legs of a round have a captured score */
export interface RoundResults {
  first: boolean;
  second: boolean;
  any: boolean;
}

const isPlayed = (match: BracketMatch) => match.status === "played";

/** A result is a captured score */
export function roundResults(round: BracketRound): RoundResults {
  const matches = round.ties.flatMap((tie) => tie.matches);
  const first = matches.some((match) => match.leg !== 2 && isPlayed(match));
  const second = matches.some((match) => match.leg === 2 && isPlayed(match));

  return { first, second, any: first || second };
}

/** One entry of the flat download menu of a round (phones): no submenus */
export interface DownloadOption {
  kind: "schedule" | "results";
  choice: LegChoice;
  /** There is nothing to download yet (a results image with no score) */
  disabled: boolean;
  /** Starts a new group: the results come after the schedules */
  divider: boolean;
}

/** The images a round offers as one list: schedules, then results; a home-and-away round adds one per leg */
export function downloadOptions(round: BracketRound): DownloadOption[] {
  const results = roundResults(round);

  if (round.legs === 1) {
    return [
      { kind: "schedule", choice: "both", disabled: false, divider: false },
      {
        kind: "results",
        choice: "both",
        disabled: !results.any,
        divider: true,
      },
    ];
  }

  const enabled = {
    first: results.first,
    second: results.second,
    both: results.any,
  };

  return (["schedule", "results"] as const).flatMap((kind) =>
    (["first", "second", "both"] as const).map((choice) => ({
      kind,
      choice,
      disabled: kind === "results" && !enabled[choice],
      divider: kind === "results" && choice === "first",
    })),
  );
}

/** The matches of a tie an image includes, in leg order */
export function matchesOf(tie: BracketTie, choice: LegChoice): BracketMatch[] {
  const sorted = [...tie.matches].sort(
    (a, b) => (a.leg ?? 0) - (b.leg ?? 0) || a.id - b.id,
  );

  return choice === "both"
    ? sorted
    : sorted.filter(
        (match) => (match.leg ?? 1) === (choice === "first" ? 1 : 2),
      );
}

/** horarios-semifinal[-liguilla-1-4][-ida]-torneo.png */
export function playoffFileName(
  kind: "horarios" | "resultados",
  round: string,
  playoff: string | null,
  choice: LegChoice | null,
  tournamentName: string,
): string {
  return `${[
    kind,
    slug(round),
    playoff ? slug(playoff) : "",
    choice === "first" ? "ida" : choice === "second" ? "vuelta" : "",
    slug(tournamentName),
  ]
    .filter(Boolean)
    .join("-")}.png`;
}

/** "Liguilla (1-4)" with several liguillas, "Liguilla" with one; "· Ida" for a leg of a home-and-away round */
function subtitleOf(input: PlayoffImageInput): string {
  const { texts, round, choice } = input;

  return [
    input.playoffsCount > 1 ? input.playoff.name : texts.liguilla,
    round.legs === 2 ? texts[choice] : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const teamOf = (team: BracketTeam, seed: number | null): PlayoffTeam => ({
  name: team.team_name,
  logo_url: team.logo_url,
  seed,
  registration_id: team.registration_id,
});

/** A side of a tie: its team, or the winner of the tie that feeds it */
function sideOf(
  input: PlayoffImageInput,
  tie: BracketTie,
  side: "a" | "b",
): PlayoffTeam {
  const team = side === "a" ? tie.team_a : tie.team_b;
  const seed = side === "a" ? tie.seed_a : tie.seed_b;

  if (team) {
    return teamOf(team, seed);
  }

  const { rounds } = input.playoff;
  const previous = rounds[rounds.indexOf(input.round) - 1];
  const tieIndex = input.round.ties.indexOf(tie);

  return {
    name: previous
      ? input.texts.winnerOf(
          previous.name.toLowerCase(),
          tieIndex * 2 + (side === "a" ? 1 : 2),
        )
      : input.texts.tbd,
    logo_url: null,
    seed: null,
    registration_id: null,
  };
}

/** The leg is played with the sides of the tie swapped (the second leg of a home-and-away tie) */
function swapped(tie: BracketTie, match: BracketMatch): boolean {
  const a = tie.team_a?.registration_id;
  const b = tie.team_b?.registration_id;
  const home = match.home_team?.registration_id;
  const away = match.away_team?.registration_id;

  if (home !== undefined && (home === b || away === a)) {
    return true;
  }

  if (home !== undefined && (home === a || away === b)) {
    return false;
  }

  return match.leg === 2;
}

/** Home and away of a match, as the sides of its tie */
function sidesOf(
  input: PlayoffImageInput,
  tie: BracketTie,
  match: BracketMatch,
): { home: PlayoffTeam; away: PlayoffTeam } {
  const flip = swapped(tie, match);

  return {
    home: sideOf(input, tie, flip ? "b" : "a"),
    away: sideOf(input, tie, flip ? "a" : "b"),
  };
}

function tagOf(match: BracketMatch): JornadaMatchTag | null {
  if (match.status === "cancelled") {
    return "cancelled";
  }

  return match.original_match_datetime ? "rescheduled" : null;
}

const dateOf = (match: BracketMatch): string | null =>
  match.match_datetime ?? match.scheduled_date;

// ---------------------------------------------------------------- Horarios

export interface PlayoffScheduleLine {
  /** "Ida" / "Vuelta" when both legs are shown together */
  leg: string | null;
  tag: JornadaMatchTag | null;
  referee: string | null;
  day: string | null;
  time: string | null;
  field: string | null;
}

export interface PlayoffScheduleEntry {
  home: PlayoffTeam;
  away: PlayoffTeam;
  lines: PlayoffScheduleLine[];
}

export interface PlayoffScheduleImageData {
  leagueName: string;
  tournamentName: string;
  title: string;
  subtitle: string;
  dates: string | null;
  entries: PlayoffScheduleEntry[];
}

/** The data of the schedule image of a round */
export function buildPlayoffScheduleData(
  input: PlayoffImageInput & { weekdayName: (weekday: number) => string },
): PlayoffScheduleImageData {
  const both = input.choice === "both" && input.round.legs === 2;
  const choice = input.round.legs === 2 ? input.choice : "both";
  const included = input.round.ties.map((tie) => ({
    tie,
    matches: matchesOf(tie, choice),
  }));

  const lineOf = (match: BracketMatch): PlayoffScheduleLine => {
    const date = dateOf(match);
    const slot = date
      ? slotParts(date.length > 10 ? date : `${date}T00:00`)
      : null;

    return {
      leg:
        both && match.leg !== null
          ? input.texts[match.leg === 1 ? "first" : "second"]
          : null,
      tag: tagOf(match),
      referee: match.referee?.name || null,
      day:
        slot && date
          ? `${input.weekdayName(slot.weekday).slice(0, 3)} ${fullDate(date)}`
          : null,
      time: match.match_datetime ? (slot?.time ?? null) : null,
      field: match.field?.name || null,
    };
  };

  return {
    leagueName: input.leagueName,
    tournamentName: input.tournamentName,
    title: input.round.name,
    subtitle: subtitleOf(input),
    dates: fullDatesRange(
      included.flatMap(({ matches }) =>
        matches.map((match) => ({ match_datetime: dateOf(match) })),
      ),
    ),
    entries: included
      .filter(({ matches }) => matches.length > 0)
      .map(({ tie, matches }) => ({
        ...(both
          ? { home: sideOf(input, tie, "a"), away: sideOf(input, tie, "b") }
          : sidesOf(input, tie, matches[0])),
        lines: matches.map(lineOf),
      })),
  };
}

// --------------------------------------------------------------- Resultados

/** What the middle of a result row shows */
export type PlayoffOutcome =
  | {
      kind: "score";
      home: number;
      away: number;
      pen: { home: number; away: number } | null;
    }
  | { kind: "tag"; tag: JornadaMatchTag }
  | { kind: "none" };

export interface PlayoffResultRow {
  leg: string | null;
  home: PlayoffTeam;
  away: PlayoffTeam;
  referee: string | null;
  outcome: PlayoffOutcome;
  /** Highlighted side: the winner of the match, or the team that advances in the tie when both legs show */
  winner: "home" | "away" | null;
}

export interface PlayoffResultEntry {
  rows: PlayoffResultRow[];
  /** Both legs together: the global (the home side of the first leg first) and how the tie was decided */
  global: { home: number; away: number } | null;
  penaltiesWin: boolean;
  walkoverWin: boolean;
}

export interface PlayoffResultsImageData {
  leagueName: string;
  tournamentName: string;
  /** "Resultados" */
  title: string;
  /** The round, in the accent colour */
  phase: string;
  subtitle: string;
  /** Both legs together: the highlight follows who advances, not each match */
  byAdvance: boolean;
  /** The champion, only in the results of the final once it is decided */
  champion: string | null;
  entries: PlayoffResultEntry[];
}

function outcomeOf(match: BracketMatch): PlayoffOutcome {
  if (match.status === "cancelled") {
    return { kind: "tag", tag: "cancelled" };
  }

  if (
    match.status === "played" &&
    match.home_goals !== null &&
    match.away_goals !== null
  ) {
    return {
      kind: "score",
      home: match.home_goals,
      away: match.away_goals,
      pen:
        match.home_penalties !== null && match.away_penalties !== null
          ? { home: match.home_penalties, away: match.away_penalties }
          : null,
    };
  }

  return match.original_match_datetime
    ? { kind: "tag", tag: "rescheduled" }
    : { kind: "none" };
}

/** The data of the results image of a round */
export function buildPlayoffResultsData(
  input: PlayoffImageInput & { title: string },
): PlayoffResultsImageData {
  const byAdvance = input.choice === "both" && input.round.legs === 2;
  const choice = input.round.legs === 2 ? input.choice : "both";

  const entries = input.round.ties
    .map((tie): PlayoffResultEntry => {
      const rows = matchesOf(tie, choice).map((match): PlayoffResultRow => {
        const outcome = outcomeOf(match);
        const sides = sidesOf(input, tie, match);
        let winner: PlayoffResultRow["winner"] = null;

        if (byAdvance) {
          const id = tie.winner_registration_id;

          winner =
            id === null
              ? null
              : sides.home.registration_id === id
                ? "home"
                : sides.away.registration_id === id
                  ? "away"
                  : null;
        } else if (outcome.kind === "score") {
          if (outcome.home !== outcome.away) {
            winner = outcome.home > outcome.away ? "home" : "away";
          } else if (input.round.legs === 1 && outcome.pen) {
            winner = outcome.pen.home > outcome.pen.away ? "home" : "away";
          }
        }

        return {
          leg:
            byAdvance && match.leg !== null
              ? input.texts[match.leg === 1 ? "first" : "second"]
              : null,
          ...sides,
          referee: match.referee?.name || null,
          outcome,
          winner,
        };
      });

      const firstHomeIsB =
        rows[0] !== undefined &&
        tie.team_b !== null &&
        rows[0].home.registration_id === tie.team_b.registration_id;
      const global =
        byAdvance && tie.aggregate
          ? firstHomeIsB
            ? { home: tie.aggregate.b, away: tie.aggregate.a }
            : { home: tie.aggregate.a, away: tie.aggregate.b }
          : null;

      return {
        rows,
        global,
        penaltiesWin: byAdvance && tie.decided_by === "penalties",
        walkoverWin: byAdvance && tie.decided_by === "walkover",
      };
    })
    .filter((entry) => entry.rows.length > 0);

  return {
    leagueName: input.leagueName,
    tournamentName: input.tournamentName,
    title: input.title,
    phase: input.round.name,
    subtitle: subtitleOf(input),
    byAdvance,
    champion:
      input.round === input.playoff.rounds.at(-1)
        ? (input.playoff.champion?.team_name ?? null)
        : null,
    entries,
  };
}
