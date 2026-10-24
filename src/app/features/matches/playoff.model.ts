/** A qualified team with the seed it takes in the bracket (1 is the best) */
export interface SeedTeam {
  seed: number;
  registration_id: number;
  team_id: number;
  team_name: string;
}

export interface QualifiedTeam extends SeedTeam {
  /** Name of the regular group the team qualified from */
  source_group: string;
  /** Its position in that group */
  position: number;
}

export interface ProposedTie {
  bracket_position: number;
  /** Only the first round has teams: the later ones wait for the winners */
  team_a: SeedTeam | null;
  team_b: SeedTeam | null;
}

export interface ProposedRound {
  name: string;
  legs: 1 | 2;
  ties: ProposedTie[];
}

/** A candidate of a best-of-position comparison, with its performance in its own group */
export interface BestOfRow {
  rank: number;
  registration_id: number;
  team_id: number;
  team_name: string;
  group: string;
  played: number;
  points: number;
  goal_difference: number;
  goals_for: number;
  points_per_match: number;
  /** Among the best: it takes a place in the playoff */
  qualified: boolean;
  /** Level with a neighbour on every criterion, no manual order yet */
  tied: boolean;
}

/** The comparison of one "best of a position" source */
export interface BestOfTable {
  source_id: number;
  position: number;
  best_count: number;
  table: BestOfRow[];
}

/** What closing the regular phase would create for one playoff */
export interface PlayoffProposal {
  group_id: number;
  name: string;
  qualified: QualifiedTeam[];
  rounds: ProposedRound[];
  /** Proposed Y-m-d of each match, first round to the final */
  dates: string[];
  round_legs: Array<1 | 2>;
  /** One comparison per best-of-position source of the playoff */
  best_of?: BestOfTable[];
}

/** What a playoff shows while something blocks the closing: no bracket yet, but its comparisons */
export interface PlayoffBestOnly {
  group_id: number;
  name: string;
  best_of: BestOfTable[];
}

export type CloseBlocker =
  | {
      type: "pending_matches";
      message: string;
      count: number;
      examples: Array<{
        match_id: number;
        group: string | null;
        matchday: number;
        home: string | null;
        away: string | null;
      }>;
    }
  | { type: "no_calendar"; message: string }
  | {
      type: "unresolved_ties";
      scope: "best_of_position";
      message: string;
      source_id: number;
      position: number;
      /** Name of the playoff */
      group: string;
      teams: string[];
    }
  | {
      type: "unresolved_ties";
      message: string;
      group: string;
      positions: number[];
    }
  | { type: string; message?: string; group?: string; count?: number };

export interface CloseWarning {
  type: string;
  message?: string;
  group?: string;
  positions?: number[];
}

/** `GET /close-regular-phase/preview`: playoffs only come when nothing blocks the closing */
export interface ClosePreview {
  blockers: CloseBlocker[];
  warnings: CloseWarning[];
  /** Full proposals without blockers; with them, only the comparisons of the best-of-position sources */
  playoffs: Array<PlayoffProposal | PlayoffBestOnly>;
}

/** `POST /close-regular-phase` */
export interface CloseBody {
  liguillas: Array<{
    group_id: number;
    ties: Array<{
      bracket_position: number;
      team_a_id: number;
      team_b_id: number;
    }>;
    /** Y-m-d per match */
    round_dates: string[];
  }>;
}

export interface BracketTeam {
  registration_id: number;
  team_id: number;
  team_name: string;
  logo_url: string | null;
}

export interface BracketMatch {
  id: number;
  /** 1 or 2 in a home-and-away round; null in a single match */
  leg: number | null;
  scheduled_date: string | null;
  home_team: BracketTeam | null;
  away_team: BracketTeam | null;
  home_goals: number | null;
  away_goals: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  status: "scheduled" | "played" | "cancelled";
}

export interface BracketTie {
  id: number;
  round_index: number;
  bracket_position: number;
  team_a: BracketTeam | null;
  team_b: BracketTeam | null;
  seed_a: number | null;
  seed_b: number | null;
  matches: BracketMatch[];
  /** Goals of each side over the played matches; null while none is played */
  aggregate: { a: number; b: number } | null;
  winner_team_id: number | null;
  winner_registration_id: number | null;
  decided_by: "goals" | "penalties" | null;
}

export interface BracketRound {
  index: number;
  name: string;
  legs: 1 | 2;
  ties: BracketTie[];
}

export interface BracketPlayoff {
  group_id: number;
  name: string;
  rounds: BracketRound[];
  champion: BracketTeam | null;
}

/** `GET /playoffs` */
export interface Bracket {
  playoffs: BracketPlayoff[];
}

/** Goals a registration scored in a match; 0 when it did not play it or there are none */
export function goalsOf(match: BracketMatch, registrationId: number): number {
  if (match.home_team?.registration_id === registrationId) {
    return match.home_goals ?? 0;
  }

  return match.away_team?.registration_id === registrationId
    ? (match.away_goals ?? 0)
    : 0;
}

/**
 * The global score, home side of `match` first, if the goals typed for it were
 * saved: the played first leg plus this one. Only a second leg has one.
 */
export function globalWith(
  tie: BracketTie,
  match: BracketMatch,
  home: number,
  away: number,
): { home: number; away: number } | null {
  const homeId = match.home_team?.registration_id;
  const awayId = match.away_team?.registration_id;
  const first = tie.matches.find((other) => other.leg === 1);

  if (
    match.leg !== 2 ||
    !first ||
    homeId === undefined ||
    awayId === undefined
  ) {
    return null;
  }

  return {
    home: home + goalsOf(first, homeId),
    away: away + goalsOf(first, awayId),
  };
}

/** Penalties are asked in a single match that ends level, or in a second leg whose global is level */
export function needsPenalties(
  tie: BracketTie,
  match: BracketMatch,
  home: number | null,
  away: number | null,
): boolean {
  if (home === null || away === null) {
    return false;
  }

  if (tie.matches.length === 1) {
    return home === away;
  }

  const global = globalWith(tie, match, home, away);

  return global !== null && global.home === global.away;
}

/** "2-1", or "2-2 (4-3 pen.)" when it went to penalties */
export function scoreText(
  match: BracketMatch,
  penalties: string,
): string | null {
  if (match.status !== "played") {
    return null;
  }

  const score = `${match.home_goals}-${match.away_goals}`;

  return match.home_penalties !== null && match.away_penalties !== null
    ? `${score} (${match.home_penalties}-${match.away_penalties} ${penalties})`
    : score;
}

/** The exact "per match" comparison the backend ranks best-of-position candidates by (points, goal difference, goals for) */
export function sameLevel(a: BestOfRow, b: BestOfRow): boolean {
  return (["points", "goal_difference", "goals_for"] as const).every(
    (field) => {
      const [na, da] = a.played === 0 ? [0, 1] : [a[field], a.played];
      const [nb, db] = b.played === 0 ? [0, 1] : [b[field], b.played];

      return nb * da === na * db;
    },
  );
}

/** The rows of a comparison that are tied, split into the sets that are level with each other */
export function tiedSets(table: BestOfTable): BestOfRow[][] {
  const sets: BestOfRow[][] = [];

  for (const row of table.table.filter((candidate) => candidate.tied)) {
    const last = sets.at(-1);

    if (last && sameLevel(last[0], row)) {
      last.push(row);
    } else {
      sets.push([row]);
    }
  }

  return sets.filter((set) => set.length > 1);
}
