import {
  BestOfRow,
  BestOfTable,
  BracketMatch,
  BracketTeam,
  BracketTie,
  globalWith,
  needsPenalties,
  sameLevel,
  scoreText,
  tiedSets,
} from "./playoff.model";

const team = (id: number): BracketTeam => ({
  registration_id: id,
  team_id: id * 10,
  team_name: `Equipo ${id}`,
  logo_url: null,
});

const match = (
  id: number,
  leg: number | null,
  home: number,
  away: number,
  score: [number, number] | null = null,
  penalties: [number, number] | null = null,
): BracketMatch => ({
  id,
  leg,
  scheduled_date: null,
  home_team: team(home),
  away_team: team(away),
  home_goals: score?.[0] ?? null,
  away_goals: score?.[1] ?? null,
  home_penalties: penalties?.[0] ?? null,
  away_penalties: penalties?.[1] ?? null,
  status: score ? "played" : "scheduled",
});

const tie = (matches: BracketMatch[]): BracketTie => ({
  id: 1,
  round_index: 1,
  bracket_position: 1,
  team_a: team(1),
  team_b: team(2),
  seed_a: 1,
  seed_b: 2,
  matches,
  aggregate: null,
  winner_team_id: null,
  winner_registration_id: null,
  decided_by: null,
});

describe("playoff model", () => {
  it("asks for penalties in a single match only on a draw", () => {
    const single = tie([match(1, null, 1, 2)]);

    expect(needsPenalties(single, single.matches[0], 1, 1)).toBe(true);
    expect(needsPenalties(single, single.matches[0], 2, 1)).toBe(false);
    expect(needsPenalties(single, single.matches[0], null, 1)).toBe(false);
  });

  it("never asks for penalties in a first leg", () => {
    const home = tie([match(1, 1, 1, 2), match(2, 2, 2, 1)]);

    expect(needsPenalties(home, home.matches[0], 1, 1)).toBe(false);
  });

  it("asks for them in a second leg only when the global is level", () => {
    // First leg: team 1 (home) 2 - 1 team 2; the second leg has team 2 at home
    const home = tie([match(1, 1, 1, 2, [2, 1]), match(2, 2, 2, 1)]);
    const second = home.matches[1];

    expect(globalWith(home, second, 1, 1)).toEqual({ home: 2, away: 3 });
    expect(needsPenalties(home, second, 1, 1)).toBe(false);
    expect(needsPenalties(home, second, 2, 1)).toBe(true);
  });

  it("writes the score, with the penalties when there were", () => {
    expect(scoreText(match(1, null, 1, 2, [2, 1]), "pen.")).toBe("2-1");
    expect(scoreText(match(1, null, 1, 2, [2, 2], [4, 3]), "pen.")).toBe(
      "2-2 (4-3 pen.)",
    );
    expect(scoreText(match(1, null, 1, 2), "pen.")).toBeNull();
  });

  const row = (
    id: number,
    played: number,
    points: number,
    gd: number,
    gf: number,
    tied = false,
  ): BestOfRow => ({
    rank: id,
    registration_id: id,
    team_id: id * 10,
    team_name: `Equipo ${id}`,
    group: "Grupo",
    played,
    points,
    goal_difference: gd,
    goals_for: gf,
    points_per_match: played ? points / played : 0,
    qualified: false,
    tied,
  });

  it("compares best-of candidates per match, so groups of other sizes are fair", () => {
    expect(sameLevel(row(1, 2, 4, 2, 4), row(2, 4, 8, 4, 8))).toBe(true);
    expect(sameLevel(row(1, 2, 4, 2, 4), row(2, 4, 8, 4, 9))).toBe(false);
    expect(sameLevel(row(1, 0, 0, 0, 0), row(2, 0, 0, 0, 0))).toBe(true);
  });

  it("splits the tied rows into the sets that are level with each other", () => {
    const table: BestOfTable = {
      source_id: 7,
      position: 4,
      best_count: 1,
      table: [
        row(1, 3, 6, 2, 5, true),
        row(2, 3, 6, 2, 5, true),
        row(3, 3, 3, 0, 2),
        row(4, 3, 1, -1, 1, true),
        row(5, 3, 1, -1, 1, true),
      ],
    };

    expect(
      tiedSets(table).map((set) => set.map((r) => r.registration_id)),
    ).toEqual([
      [1, 2],
      [4, 5],
    ]);
  });
});
