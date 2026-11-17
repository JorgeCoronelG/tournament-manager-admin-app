import { StandingGroup, StandingPlayoff, StandingRow } from "../match.model";
import { buildImageData, exportFileName, slug } from "./standings-image.model";

const row = (
  position: number,
  name: string,
  extra: Partial<StandingRow> = {},
): StandingRow => ({
  position,
  registration_id: position,
  team_id: position * 10,
  team_name: name,
  logo_url: null,
  played: 7,
  won: 0,
  drawn: 0,
  lost: 0,
  goals_for: 0,
  goals_against: 0,
  goal_difference: 0,
  points: 0,
  tied: false,
  ...extra,
});

const playoffs: StandingPlayoff[] = [
  { id: 2, name: "Consolación", priority: 2, positions: "3-4" },
  { id: 1, name: "Principal", priority: 1, positions: "1-2" },
];

const group = (overrides: Partial<StandingGroup> = {}): StandingGroup => ({
  group_id: 1,
  group_name: "Grupo A",
  criteria: [],
  ties: [],
  rows: [
    row(1, "Halcones", { playoff: { id: 1, name: "Principal", priority: 1 } }),
    row(2, "Tigres", {
      playoff: { id: 1, name: "Principal", priority: 1 },
      played: 6,
    }),
    row(3, "Águilas", {
      playoff: { id: 2, name: "Consolación", priority: 2 },
    }),
    row(4, "Leones", { playoff: null, playoff_pending: true }),
    row(5, "Toros"),
  ],
  ...overrides,
});

const build = (g = group(), groupsCount = 1, list = playoffs) =>
  buildImageData({
    leagueName: "Liga Demo",
    tournamentName: "Torneo Cuatro",
    group: g,
    groupsCount,
    playoffs: list,
    now: new Date(2026, 10, 17),
    legendLabel: (playoff) => `${playoff.name} (${playoff.positions})`,
  });

describe("exportFileName", () => {
  it("slugs the tournament and the group, with the date", () => {
    expect(
      exportFileName(
        "Torneo Cuatro Águilas",
        "Grupo Á",
        new Date(2026, 10, 17),
      ),
    ).toBe("posiciones-torneo-cuatro-aguilas-grupo-a-2026-11-17.png");
  });

  it("leaves the group out when there is none", () => {
    expect(exportFileName("Torneo Cuatro", null, new Date(2026, 0, 5))).toBe(
      "posiciones-torneo-cuatro-2026-01-05.png",
    );
  });

  it("slug drops symbols and the hyphens around them", () => {
    expect(slug("  ¡Copa: Ñandú! ")).toBe("copa-nandu");
  });
});

describe("buildImageData", () => {
  it("gives the legend by priority with the light colours", () => {
    expect(build().legend).toEqual([
      { label: "Principal (1-2)", bar: "bg-indigo-600", chip: "bg-indigo-100" },
      {
        label: "Consolación (3-4)",
        bar: "bg-emerald-600",
        chip: "bg-emerald-100",
      },
    ]);
  });

  it("colours the qualified teams and leaves the rest without a bar", () => {
    expect(build().rows.map((item) => item.bar)).toEqual([
      "bg-indigo-600",
      "bg-indigo-600",
      "bg-emerald-600",
      null, // qualification still to be defined
      null, // does not qualify
    ]);
  });

  it("has no legend nor bars without playoffs", () => {
    const data = build(group(), 1, []);

    expect(data.legend).toEqual([]);
    expect(data.rows.every((item) => item.bar === null)).toBe(true);
  });

  it("names the group only when there are several, and reaches the top matchday", () => {
    expect(build(group(), 1).groupName).toBeNull();
    expect(build(group(), 2).groupName).toBe("Grupo A");
    expect(build().matchday).toBe(7);
    expect(build().updated).toBe("17/11/2026");
  });

  it("flags the unresolved ties", () => {
    expect(build().tiesPending).toBe(false);
    expect(build(group({ ties_pending: true })).tiesPending).toBe(true);
  });
});
