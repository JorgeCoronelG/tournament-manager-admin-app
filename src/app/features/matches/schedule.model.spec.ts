import {
  deficitLines,
  datesRange,
  slotLabel,
  slotParts,
} from "./schedule.model";

describe("schedule.model", () => {
  const names = (weekday: number) =>
    ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][
      weekday - 1
    ];

  it("reads weekday, date and 12-hour time", () => {
    expect(slotParts("2026-11-07T08:00:00")).toEqual({
      weekday: 6,
      date: "07/11",
      time: "8:00 a.m.",
    });
    expect(slotParts("2026-11-08T12:30:00+00:00").time).toBe("12:30 p.m.");
    expect(slotParts("2026-11-08T00:15:00").time).toBe("12:15 a.m.");
  });

  it("labels the slot with its field", () => {
    expect(slotLabel("2026-11-07T08:00:00", "Cancha 1", names)).toBe(
      "Sáb 07/11 · 8:00 a.m. · Cancha 1",
    );
    expect(slotLabel("2026-11-07T15:00:00", null, names)).toBe(
      "Sáb 07/11 · 3:00 p.m.",
    );
  });

  it("gives the range of the dated matches", () => {
    expect(
      datesRange([
        { match_datetime: "2026-11-08T09:00:00" },
        { match_datetime: null },
        { match_datetime: "2026-11-02T09:00:00" },
      ]),
    ).toBe("02/11 - 08/11");
    expect(datesRange([{ match_datetime: null }])).toBeNull();
  });
});

describe("deficitLines", () => {
  const texts: Record<string, string> = {
    "matches.config.capacity.and": "y",
    "matches.config.capacity.matchdayOne": "la jornada {{list}}",
    "matches.config.capacity.matchdayMany": "las jornadas {{list}}",
    "matches.config.capacity.missingOne": "Falta 1 espacio en {{where}}.",
    "matches.config.capacity.missingMany":
      "Faltan {{count}} espacios en {{where}}.",
  };
  const translate = (key: string, params: Record<string, unknown> = {}) =>
    texts[key].replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
      String(params[name]),
    );

  it("groups the matchdays by missing slots, the largest first", () => {
    expect(
      deficitLines(
        [
          { matchday: 1, deficit: 2 },
          { matchday: 2, deficit: 1 },
          { matchday: 3, deficit: 0 },
          { matchday: 4, deficit: 1 },
          { matchday: 5, deficit: 1 },
        ],
        translate,
      ),
    ).toEqual([
      "Faltan 2 espacios en la jornada 1.",
      "Falta 1 espacio en las jornadas 2, 4 y 5.",
    ]);
  });

  it("says nothing without a deficit", () => {
    expect(deficitLines([{ matchday: 1, deficit: 0 }], translate)).toEqual([]);
  });
});
