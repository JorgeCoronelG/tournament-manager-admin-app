import { BracketMatch, BracketPlayoff, BracketRound } from "../playoff.model";
import { bracketMatch, round, team, tie } from "./playoff-fixtures";
import {
  buildPlayoffResultsData,
  buildPlayoffScheduleData,
  downloadOptions,
  LegChoice,
  playoffFileName,
  roundResults,
} from "./playoff-image.model";

const played = (
  id: number,
  leg: number | null,
  home: number,
  away: number,
  overrides: Partial<BracketMatch> = {},
) =>
  bracketMatch(id, {
    leg,
    status: "played",
    home_goals: home,
    away_goals: away,
    ...overrides,
  });

const playoffOf = (...rounds: BracketRound[]): BracketPlayoff => ({
  group_id: 1,
  name: "Liguilla (1-4)",
  rounds,
  champion: null,
});

const texts = {
  liguilla: "Liguilla",
  first: "Ida",
  second: "Vuelta",
  both: "Ida y vuelta",
  tbd: "Por definir",
  winnerOf: (name: string, n: number) => `Ganador ${name} ${n}`,
};

const input = (
  current: BracketRound,
  choice: LegChoice = "both",
  playoffsCount = 1,
  before: BracketRound[] = [],
) => ({
  leagueName: "Liga Demo",
  tournamentName: "Torneo Cuatro",
  playoffsCount,
  playoff: playoffOf(...before, current),
  round: current,
  choice,
  texts,
});

const weekdayName = () => "Sábado";

describe("roundResults", () => {
  it("tells which legs have a captured score", () => {
    const none = round([
      tie([bracketMatch(1, { leg: 1 }), bracketMatch(2, { leg: 2 })]),
    ]);
    const first = round([
      tie([played(1, 1, 1, 0), bracketMatch(2, { leg: 2 })]),
    ]);
    const second = round([
      tie([bracketMatch(1, { leg: 1 }), played(2, 2, 1, 0)]),
    ]);

    expect(roundResults(none)).toEqual({
      first: false,
      second: false,
      any: false,
    });
    expect(roundResults(first)).toEqual({
      first: true,
      second: false,
      any: true,
    });
    expect(roundResults(second)).toEqual({
      first: false,
      second: true,
      any: true,
    });
  });

  it("counts a single match as the first leg", () => {
    expect(roundResults(round([tie([played(1, null, 1, 0)])])).any).toBe(true);
  });
});

describe("playoffFileName", () => {
  it("adds the liguilla and the leg only when they apply", () => {
    expect(
      playoffFileName("horarios", "Semifinal", null, null, "Torneo Cuatro"),
    ).toBe("horarios-semifinal-torneo-cuatro.png");
    expect(
      playoffFileName(
        "resultados",
        "Cuartos de final",
        "Liguilla (1-4)",
        "first",
        "Torneo Cuatro",
      ),
    ).toBe("resultados-cuartos-de-final-liguilla-1-4-ida-torneo-cuatro.png");
    expect(playoffFileName("horarios", "Final", null, "second", "Torneo")).toBe(
      "horarios-final-vuelta-torneo.png",
    );
    expect(playoffFileName("horarios", "Final", null, "both", "Torneo")).toBe(
      "horarios-final-torneo.png",
    );
  });
});

describe("buildPlayoffScheduleData", () => {
  const build = (r: BracketRound, choice: LegChoice = "both", count = 1) =>
    buildPlayoffScheduleData({ ...input(r, choice, count), weekdayName });

  it("shows a single match with its slot, seeds and referee", () => {
    const data = build(round([tie([bracketMatch(1)])]));

    expect(data.title).toBe("Semifinal");
    expect(data.subtitle).toBe("Liguilla");
    expect(data.dates).toBe("28/11/2026");
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].home).toMatchObject({ name: "Halcones", seed: 1 });
    expect(data.entries[0].away).toMatchObject({ name: "Tigres", seed: 4 });
    expect(data.entries[0].lines).toEqual([
      {
        leg: null,
        tag: null,
        referee: "Luis Pérez",
        day: "Sáb 28/11/2026",
        time: "8:00 a.m.",
        field: "Cancha 1",
      },
    ]);
  });

  it("names the liguilla only with several", () => {
    const r = round([tie([bracketMatch(1)])]);

    expect(build(r, "both", 2).subtitle).toBe("Liguilla (1-4)");
  });

  it("shows one leg per row with the leg in the subtitle", () => {
    const r = round(
      [
        tie([
          bracketMatch(1, { leg: 1 }),
          bracketMatch(2, {
            leg: 2,
            home_team: team(2, "Tigres"),
            away_team: team(1, "Halcones"),
            match_datetime: "2026-11-29T10:00:00",
          }),
        ]),
      ],
      2,
    );
    const first = build(r, "first");
    const second = build(r, "second");

    expect(first.subtitle).toBe("Liguilla · Ida");
    expect(first.entries[0].lines).toHaveLength(1);
    expect(first.entries[0].home.name).toBe("Halcones");
    expect(second.subtitle).toBe("Liguilla · Vuelta");
    expect(second.entries[0].home.name).toBe("Tigres");
    expect(second.entries[0].lines[0].day).toBe("Sáb 29/11/2026");
  });

  it("shows both legs as a block of two lines with the range of dates", () => {
    const r = round(
      [
        tie([
          bracketMatch(1, { leg: 1 }),
          bracketMatch(2, { leg: 2, match_datetime: "2026-11-29T10:00:00" }),
        ]),
      ],
      2,
    );
    const data = build(r, "both");

    expect(data.subtitle).toBe("Liguilla · Ida y vuelta");
    expect(data.dates).toBe("28/11/2026 – 29/11/2026");
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].lines.map((line) => line.leg)).toEqual([
      "Ida",
      "Vuelta",
    ]);
  });

  it("names the feeder of a team still to be defined", () => {
    const semis = round([tie([]), tie([])], 1, "Semifinal");
    const final = {
      ...round(
        [
          tie([bracketMatch(9, { home_team: null, away_team: null })], {
            team_a: null,
            team_b: null,
            seed_a: null,
            seed_b: null,
          }),
        ],
        1,
        "Final",
      ),
      index: 1,
    };
    const data = buildPlayoffScheduleData({
      ...input(final, "both", 1, [semis]),
      weekdayName,
    });

    expect(data.entries[0].home.name).toBe("Ganador semifinal 1");
    expect(data.entries[0].away.name).toBe("Ganador semifinal 2");
  });

  it("says to define what is missing, and no referee", () => {
    const data = build(
      round([
        tie([
          bracketMatch(1, {
            match_datetime: null,
            field: null,
            referee: null,
          }),
        ]),
      ]),
    );

    expect(data.dates).toBeNull();
    expect(data.entries[0].lines[0]).toMatchObject({
      referee: null,
      day: null,
      time: null,
      field: null,
    });
  });

  it("never carries a score and tags a called off or moved match", () => {
    const data = build(
      round([
        tie([played(1, null, 2, 1, { status: "cancelled" })]),
        tie([
          played(2, null, 2, 1, {
            original_match_datetime: "2026-11-21T08:00:00",
          }),
        ]),
      ]),
    );

    expect(data.entries.map((entry) => entry.lines[0].tag)).toEqual([
      "cancelled",
      "rescheduled",
    ]);
    expect(data.entries[0].lines[0]).not.toHaveProperty("outcome");
  });
});

describe("buildPlayoffResultsData", () => {
  const build = (r: BracketRound, choice: LegChoice = "both", count = 1) =>
    buildPlayoffResultsData({
      ...input(r, choice, count),
      title: "Resultados",
    });

  it("titles with the round and the liguilla", () => {
    const data = build(round([tie([played(1, null, 2, 1)])]), "both", 2);

    expect(data.title).toBe("Resultados");
    expect(data.phase).toBe("Semifinal");
    expect(data.subtitle).toBe("Liguilla (1-4)");
    expect(data.byAdvance).toBe(false);
  });

  it("highlights the home or the away winner of a single match", () => {
    const [home, away] = build(
      round([tie([played(1, null, 2, 1)]), tie([played(2, null, 0, 3)])]),
    ).entries;

    expect(home.rows[0].winner).toBe("home");
    expect(away.rows[0].winner).toBe("away");
  });

  it("highlights nobody in a draw of a leg", () => {
    const data = build(
      round([tie([played(1, 1, 1, 1), bracketMatch(2, { leg: 2 })])], 2),
      "first",
    );

    expect(data.subtitle).toBe("Liguilla · Ida");
    expect(data.entries[0].rows[0].winner).toBeNull();
  });

  it("shows a tag for a match without result", () => {
    const [pending, cancelled, moved] = build(
      round([
        tie([bracketMatch(1)]),
        tie([bracketMatch(2, { status: "cancelled" })]),
        tie([
          bracketMatch(3, { original_match_datetime: "2026-11-21T08:00:00" }),
        ]),
      ]),
    ).entries;

    expect(pending.rows[0].outcome).toEqual({ kind: "none" });
    expect(cancelled.rows[0].outcome).toEqual({
      kind: "tag",
      tag: "cancelled",
    });
    expect(moved.rows[0].outcome).toEqual({ kind: "tag", tag: "rescheduled" });
  });

  it("leaves the referee empty when none is assigned", () => {
    const data = build(round([tie([bracketMatch(1, { referee: null })])]));

    expect(data.entries[0].rows[0].referee).toBeNull();
  });

  it("shows both legs with the global and highlights who advances", () => {
    const r = round(
      [
        tie(
          [
            played(1, 1, 1, 0),
            played(2, 2, 2, 2, {
              home_team: team(2, "Tigres"),
              away_team: team(1, "Halcones"),
            }),
          ],
          {
            aggregate: { a: 3, b: 2 },
            winner_registration_id: 1,
            winner_team_id: 1,
          },
        ),
      ],
      2,
    );
    const data = build(r, "both");
    const [entry] = data.entries;

    expect(data.byAdvance).toBe(true);
    expect(data.subtitle).toBe("Liguilla · Ida y vuelta");
    expect(entry.rows.map((row) => row.leg)).toEqual(["Ida", "Vuelta"]);
    expect(entry.global).toEqual({ home: 3, away: 2 });
    // Halcones advance: home in the first leg, away in the second
    expect(entry.rows.map((row) => row.winner)).toEqual(["home", "away"]);
    expect(entry.penaltiesWin).toBe(false);
  });

  it("shows the penalties and the global oriented as the first leg", () => {
    const r = round(
      [
        tie(
          [
            played(1, 1, 0, 0, {
              home_team: team(2, "Tigres"),
              away_team: team(1, "Halcones"),
            }),
            played(2, 2, 0, 0, { home_penalties: 4, away_penalties: 5 }),
          ],
          {
            aggregate: { a: 0, b: 0 },
            winner_registration_id: 2,
            decided_by: "penalties",
          },
        ),
      ],
      2,
    );
    const [entry] = build(r, "both").entries;

    expect(entry.penaltiesWin).toBe(true);
    expect(entry.rows[1].outcome).toEqual({
      kind: "score",
      home: 0,
      away: 0,
      pen: { home: 4, away: 5 },
    });
    expect(entry.rows.map((row) => row.winner)).toEqual(["home", "away"]);
  });

  it("names the champion only in the results of the final", () => {
    const semis = round([tie([played(1, null, 1, 0)])], 1, "Semifinal");
    const final = {
      ...round([tie([played(2, null, 4, 2)])], 1, "Final"),
      index: 1,
    };
    const playoff = {
      ...playoffOf(semis, final),
      champion: team(1, "Halcones"),
    };
    const base = { ...input(final, "both", 1, [semis]), playoff };

    expect(
      buildPlayoffResultsData({ ...base, title: "Resultados" }).champion,
    ).toBe("Halcones");
    expect(
      buildPlayoffResultsData({ ...base, round: semis, title: "Resultados" })
        .champion,
    ).toBeNull();
    expect(
      buildPlayoffResultsData({
        ...base,
        playoff: { ...playoff, champion: null },
        title: "Resultados",
      }).champion,
    ).toBeNull();
  });
});

describe("downloadOptions", () => {
  const summary = (r: BracketRound) =>
    downloadOptions(r).map(
      (o) => `${o.kind}:${o.choice}${o.disabled ? ":off" : ""}`,
    );

  it("offers the schedule and the results of a single-match round", () => {
    expect(summary(round([tie([bracketMatch(1)])], 1))).toEqual([
      "schedule:both",
      "results:both:off",
    ]);
    expect(summary(round([tie([played(1, null, 1, 0)])], 1))).toEqual([
      "schedule:both",
      "results:both",
    ]);
  });

  it("lists every leg of a home-and-away round without submenus", () => {
    const r = round(
      [tie([played(1, 1, 1, 0), bracketMatch(2, { leg: 2 })])],
      2,
    );

    expect(summary(r)).toEqual([
      "schedule:first",
      "schedule:second",
      "schedule:both",
      "results:first",
      "results:second:off",
      "results:both",
    ]);
    expect(downloadOptions(r).filter((o) => o.divider)).toHaveLength(1);
  });

  it("disables every result while nothing was played", () => {
    const r = round([tie([bracketMatch(1, { leg: 1 })])], 2);

    expect(
      downloadOptions(r)
        .filter((o) => o.kind === "results")
        .every((o) => o.disabled),
    ).toBe(true);
  });
});
