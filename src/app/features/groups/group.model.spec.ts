import {
  autoRoundDates,
  datesInOrder,
  isValidPlayoffTotal,
  playoffRounds,
  playoffTotal,
  roundLabel,
} from "./group.model";

describe("group model", () => {
  it("adds up the teams of every source", () => {
    expect(
      playoffTotal([
        { position_start: 1, position_end: 4 },
        { position_start: 1, position_end: 2 },
      ]),
    ).toBe(6);
  });

  it("ignores rows that are not valid yet", () => {
    expect(
      playoffTotal([
        { position_start: null, position_end: 4 },
        { position_start: 3, position_end: 2 },
        { position_start: 0, position_end: 2 },
        { position_start: 1.5, position_end: 3 },
        { position_start: 1, position_end: 2 },
      ]),
    ).toBe(2);
  });

  it("accepts only powers of 2 from 2 up", () => {
    for (const total of [2, 4, 8, 16, 32]) {
      expect(isValidPlayoffTotal(total)).toBe(true);
    }

    for (const total of [0, 1, 3, 6, 12, 33]) {
      expect(isValidPlayoffTotal(total)).toBe(false);
    }
  });

  it("lists the rounds from the first to the final", () => {
    expect(playoffRounds(8)).toEqual([8, 4, 2]);
    expect(playoffRounds(2)).toEqual([2]);
    expect(playoffRounds(6)).toEqual([]);
  });

  it("names the rounds, falling back to the number of teams", () => {
    expect(roundLabel(2).key).toBe("groups.round.2");
    expect(roundLabel(16).key).toBe("groups.round.16");
    expect(roundLabel(32)).toEqual({
      key: "groups.round.other",
      params: { teams: 32 },
    });
  });

  it("spaces the rounds by the interval from the start date", () => {
    expect(autoRoundDates(new Date(2026, 10, 2), 7, 3)).toEqual([
      new Date(2026, 10, 2),
      new Date(2026, 10, 9),
      new Date(2026, 10, 16),
    ]);
  });

  it("leaves rounds without a date when the start or the interval is missing", () => {
    expect(autoRoundDates(null, 7, 2)).toEqual([null, null]);
    expect(autoRoundDates(new Date(2026, 10, 2), null, 2)).toEqual([
      new Date(2026, 10, 2),
      null,
    ]);
  });

  it("checks that the dates grow, skipping the ones not set", () => {
    const [a, b, c] = [
      new Date(2026, 10, 2),
      new Date(2026, 10, 9),
      new Date(2026, 10, 16),
    ];

    expect(datesInOrder([a, null, c])).toBe(true);
    expect(datesInOrder([a, b, c])).toBe(true);
    expect(datesInOrder([b, a, c])).toBe(false);
    expect(datesInOrder([a, a])).toBe(false);
  });

  it("counts the teams of a best-of-position source as the ones that qualify", () => {
    expect(
      playoffTotal([
        { position_start: 1, position_end: 3 },
        {
          kind: "best_of_position",
          position_start: 4,
          position_end: null,
          best_count: 1,
        },
      ]),
    ).toBe(4);
    expect(
      playoffTotal([
        {
          kind: "best_of_position",
          position_start: 4,
          position_end: null,
          best_count: null,
        },
      ]),
    ).toBe(0);
  });
});
