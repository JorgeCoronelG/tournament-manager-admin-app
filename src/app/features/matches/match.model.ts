export type MatchStatus = "scheduled" | "played" | "cancelled";

/** One side of a match; null when the registration or its team no longer exists */
export interface MatchSide {
  registration_id: number;
  team_id: number;
  team_name: string;
  logo_url: string | null;
}

export interface Match {
  id: number;
  group_id: number;
  group_name: string | null;
  matchday: number;
  /** 1 or 2: the second one only with a double round-robin */
  round_number: number;
  status: MatchStatus;
  /** ISO 8601; null while the match has no date ("Por programar") */
  match_datetime: string | null;
  /** Field it is played in; null until the hours are assigned */
  field?: { id: number; name: string | null } | null;
  /** Person who referees it; null while none is assigned */
  referee?: { id: number; name: string | null } | null;
  /** Fixed by hand: the generator does not move it */
  schedule_locked?: boolean;
  /** Date it had before being rescheduled by hand; null when it was not */
  original_match_datetime?: string | null;
  home: MatchSide | null;
  away: MatchSide | null;
  home_score: number | null;
  away_score: number | null;
}

/** A team that has no match in a matchday */
export interface RestingTeam {
  registration_id: number;
  team_name: string;
}

export interface Matchday {
  matchday: number;
  round_number: number;
  matches: Match[];
  resting: RestingTeam[];
}

export interface GroupSchedule {
  group_id: number;
  group_name: string;
  matchdays: Matchday[];
}

/** `GET /matches/schedule` */
export interface Schedule {
  generated: boolean;
  groups: GroupSchedule[];
}

export interface GeneratedGroup {
  group_id: number;
  group_name: string;
  teams: number;
  matchdays: number;
  matches: number;
}

/** `POST /matches/generate` */
export interface GenerateResult {
  groups: GeneratedGroup[];
  total_matches: number;
}

/** Matchdays of the group that share a round (vuelta) */
export interface RoundSchedule {
  round: number;
  matchdays: Matchday[];
}

/** Matchdays of a single round-robin: n teams play n - 1 (n when odd, one rests each day) */
export function matchdaysPerRound(teams: number): number {
  return teams < 2 ? 0 : teams - 1 + (teams % 2);
}

/** What generating gives for a group of `teams`, for the preview before asking the backend */
export function estimateGroup(
  teams: number,
  rounds: number,
): { matchdays: number; matches: number } {
  return {
    matchdays: matchdaysPerRound(teams) * rounds,
    matches: Math.max(0, (teams * (teams - 1)) / 2) * rounds,
  };
}

/** The matches of a group schedule */
export function matchCount(group: GroupSchedule): number {
  return group.matchdays.reduce((sum, day) => sum + day.matches.length, 0);
}

/** A played or cancelled match: the schedule can no longer be replaced */
export function hasPlayedMatches(schedule: Schedule | undefined): boolean {
  return (
    schedule?.groups.some((group) =>
      group.matchdays.some((day) =>
        day.matches.some((match) => match.status !== "scheduled"),
      ),
    ) ?? false
  );
}

/** Groups the matchdays by round, in order; one round when there is no second leg */
export function byRound(matchdays: readonly Matchday[]): RoundSchedule[] {
  const rounds = new Map<number, Matchday[]>();

  for (const day of matchdays) {
    rounds.set(day.round_number, [
      ...(rounds.get(day.round_number) ?? []),
      day,
    ]);
  }

  return [...rounds.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, days]) => ({ round, matchdays: days }));
}

/** Matches of a group with a result */
export function playedCount(group: GroupSchedule): number {
  return group.matchdays.reduce(
    (sum, day) =>
      sum + day.matches.filter((match) => match.status === "played").length,
    0,
  );
}

/** A row of a group's table; `tied` while the criteria cannot tell it from a neighbour */
export interface StandingRow {
  position: number;
  registration_id: number;
  team_id: number;
  team_name: string;
  logo_url: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  tied: boolean;
}

export interface StandingGroup {
  group_id: number;
  group_name: string;
  /** The tournament's tiebreakers, in order */
  criteria: string[];
  rows: StandingRow[];
  /** Registration ids of each set of teams that are still tied */
  ties: number[][];
  /** True when the backend keeps a manual order for the group (absent if it does not say) */
  has_manual_order?: boolean;
}

/** `GET /standings` */
export interface Standings {
  groups: StandingGroup[];
}
