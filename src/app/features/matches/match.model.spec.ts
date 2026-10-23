import {
  byRound,
  estimateGroup,
  hasPlayedMatches,
  Match,
  Matchday,
  matchdaysPerRound,
  Schedule,
} from "./match.model";

const match = (id: number, status: Match["status"] = "scheduled"): Match => ({
  id,
  group_id: 1,
  group_name: "Grupo A",
  matchday: 1,
  round_number: 1,
  status,
  match_datetime: null,
  home: null,
  away: null,
  home_score: null,
  away_score: null,
});

const day = (matchday: number, round_number: number): Matchday => ({
  matchday,
  round_number,
  matches: [],
  resting: [],
});

describe("match model", () => {
  it("counts the matchdays of one round-robin: one rests each day with an odd number", () => {
    expect(matchdaysPerRound(1)).toBe(0);
    expect(matchdaysPerRound(4)).toBe(3);
    expect(matchdaysPerRound(5)).toBe(5);
  });

  it("estimates matchdays and matches, doubled with two rounds", () => {
    expect(estimateGroup(4, 1)).toEqual({ matchdays: 3, matches: 6 });
    expect(estimateGroup(5, 2)).toEqual({ matchdays: 10, matches: 20 });
    expect(estimateGroup(0, 1)).toEqual({ matchdays: 0, matches: 0 });
  });

  it("knows the calendar is frozen once a match is no longer scheduled", () => {
    const schedule = (status: Match["status"]): Schedule => ({
      generated: true,
      groups: [
        {
          group_id: 1,
          group_name: "Grupo A",
          matchdays: [{ ...day(1, 1), matches: [match(1), match(2, status)] }],
        },
      ],
    });

    expect(hasPlayedMatches(schedule("scheduled"))).toBe(false);
    expect(hasPlayedMatches(schedule("played"))).toBe(true);
    expect(hasPlayedMatches(undefined)).toBe(false);
  });

  it("splits the matchdays by round, in order", () => {
    const rounds = byRound([day(1, 1), day(2, 1), day(3, 2)]);

    expect(rounds.map((r) => [r.round, r.matchdays.length])).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });
});
