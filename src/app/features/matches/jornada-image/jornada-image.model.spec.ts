import { Match, Matchday } from "../match.model";
import {
  buildJornadaImageData,
  buildResultsImageData,
  fullDatesRange,
  hasResults,
  jornadaFileName,
  resultsFileName,
} from "./jornada-image.model";

const side = (id: number, name: string) => ({
  registration_id: id,
  team_id: id,
  team_name: name,
  logo_url: null,
});

const match = (overrides: Partial<Match> = {}): Match => ({
  id: 1,
  group_id: 1,
  group_name: "Grupo A",
  matchday: 3,
  round_number: 1,
  status: "scheduled",
  match_datetime: "2026-11-28T08:00:00",
  field: { id: 1, name: "Cancha 1" },
  referee: { id: 1, name: "Luis Pérez" },
  home: side(1, "Halcones"),
  away: side(2, "Tigres"),
  home_score: null,
  away_score: null,
  ...overrides,
});

const day = (...matches: Match[]): Matchday => ({
  matchday: 3,
  round_number: 1,
  matches,
  resting: [],
});

const build = (matches: Match[], groupName: string | null = null) =>
  buildJornadaImageData({
    leagueName: "Liga Demo",
    tournamentName: "Torneo Cuatro",
    day: day(...matches),
    groupName,
    phase: "Fase regular",
    matchdayLabel: (n) => `Jornada ${n}`,
    weekdayName: () => "Sábado",
  });

describe("jornadaFileName", () => {
  it("slugs the tournament, with and without group", () => {
    expect(jornadaFileName(3, null, "Torneo Cuatro Águilas")).toBe(
      "calendario-jornada-3-torneo-cuatro-aguilas.png",
    );
    expect(jornadaFileName(3, "Grupo A", "Torneo Cuatro")).toBe(
      "calendario-jornada-3-grupo-a-torneo-cuatro.png",
    );
  });
});

describe("fullDatesRange", () => {
  it("gives a range, one date for a single day and null without dates", () => {
    expect(
      fullDatesRange([
        { match_datetime: "2026-11-29T10:00:00" },
        { match_datetime: "2026-11-28T08:00:00" },
        { match_datetime: null },
      ]),
    ).toBe("28/11/2026 – 29/11/2026");
    expect(fullDatesRange([{ match_datetime: "2026-11-28T08:00:00" }])).toBe(
      "28/11/2026",
    );
    expect(fullDatesRange([{ match_datetime: null }])).toBeNull();
  });
});

describe("buildJornadaImageData", () => {
  it("titles the matchday with the group only when given", () => {
    expect(build([match()]).title).toBe("Jornada 3");
    expect(build([match()], "Grupo A").title).toBe("Jornada 3 · Grupo A");
  });

  it("gives the slot of a match", () => {
    expect(build([match()]).matches[0]).toMatchObject({
      day: "Sáb 28/11/2026",
      time: "8:00 a.m.",
      field: "Cancha 1",
      referee: "Luis Pérez",
      tag: null,
    });
  });

  it("never carries a score, even for a played match", () => {
    const [played] = build([
      match({ status: "played", home_score: 2, away_score: 1 }),
    ]).matches;

    expect(played).not.toHaveProperty("score");
    expect(played.tag).toBeNull();
  });

  it("leaves the missing date, time and field empty, each on its own", () => {
    const [noDate] = build([
      match({ match_datetime: null, field: { id: 1, name: "Cancha 2" } }),
    ]).matches;
    const [noField] = build([match({ field: null })]).matches;

    expect(noDate).toMatchObject({ day: null, time: null, field: "Cancha 2" });
    expect(noField).toMatchObject({ day: "Sáb 28/11/2026", field: null });
  });

  it("leaves the referee empty when none is assigned", () => {
    expect(build([match({ referee: null })]).matches[0].referee).toBeNull();
  });

  it("tags a called off or moved match", () => {
    expect(build([match({ status: "cancelled" })]).matches[0].tag).toBe(
      "cancelled",
    );
    expect(
      build([match({ original_match_datetime: "2026-11-21T08:00:00" })])
        .matches[0].tag,
    ).toBe("rescheduled");
  });
});

const buildResults = (matches: Match[], groupName: string | null = null) =>
  buildResultsImageData({
    leagueName: "Liga Demo",
    tournamentName: "Torneo Cuatro",
    day: day(...matches),
    groupName,
    phase: "Fase regular",
    title: "Resultados",
    matchdayLabel: (n) => `Jornada ${n}`,
  });

const played = (home: number, away: number) =>
  match({ status: "played", home_score: home, away_score: away });

describe("resultsFileName", () => {
  it("prefixes with resultados", () => {
    expect(resultsFileName(3, "Grupo A", "Torneo Cuatro")).toBe(
      "resultados-jornada-3-grupo-a-torneo-cuatro.png",
    );
  });
});

describe("hasResults", () => {
  it("is true with at least one played match", () => {
    expect(hasResults([match()])).toBe(false);
    expect(hasResults([match(), played(1, 0)])).toBe(true);
    expect(hasResults([])).toBe(false);
  });
});

describe("buildResultsImageData", () => {
  it("names the group in the subtitle only when given", () => {
    const one = buildResults([played(1, 0)]);
    const several = buildResults([played(1, 0)], "Grupo A");

    expect(one.title).toBe("Resultados");
    expect(one.matchday).toBe("Jornada 3");
    expect(one.subtitle).toBe("Fase regular");
    expect(several.subtitle).toBe("Fase regular · Grupo A");
  });

  it("highlights the home or the away winner", () => {
    const [home, away] = buildResults([played(3, 1), played(0, 2)]).matches;

    expect(home.winner).toBe("home");
    expect(home.outcome).toEqual({ kind: "score", home: 3, away: 1 });
    expect(away.winner).toBe("away");
  });

  it("highlights nobody in a draw", () => {
    const [draw] = buildResults([played(2, 2)]).matches;

    expect(draw.outcome).toEqual({ kind: "score", home: 2, away: 2 });
    expect(draw.winner).toBeNull();
  });

  it("marks a match without result", () => {
    const [pending] = buildResults([match()]).matches;

    expect(pending.outcome).toEqual({ kind: "none" });
    expect(pending.winner).toBeNull();
  });

  it("shows the tag of a called off or moved match instead of the score", () => {
    const [cancelled, moved] = buildResults([
      match({ status: "cancelled" }),
      match({ original_match_datetime: "2026-11-21T08:00:00" }),
    ]).matches;

    expect(cancelled.outcome).toEqual({ kind: "tag", tag: "cancelled" });
    expect(moved.outcome).toEqual({ kind: "tag", tag: "rescheduled" });
  });

  it("leaves the referee empty when none is assigned", () => {
    expect(
      buildResults([match({ referee: null })]).matches[0].referee,
    ).toBeNull();
    expect(buildResults([match()]).matches[0].referee).toBe("Luis Pérez");
  });
});
