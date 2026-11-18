import {
  deficitLines,
  datesRange,
  slotLabel,
  slotParts,
  sortSwapCandidates,
} from "./schedule.model";
import { busyReasonLabel } from "./match-schedule.model";
import { Match } from "./match.model";

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

  it("shows a single day when every match is on the same one", () => {
    expect(
      datesRange([
        { match_datetime: "2026-01-14T17:00:00" },
        { match_datetime: "2026-01-14T19:00:00" },
      ]),
    ).toBe("14/01");
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

  describe("sortSwapCandidates", () => {
    const make = (
      id: number,
      datetime: string | null,
      field: string | null,
      group: string,
      matchday: number,
    ) =>
      ({
        id,
        match_datetime: datetime,
        field: field ? { id: 1, name: field } : null,
        group_name: group,
        matchday,
      }) as unknown as Match;

    it("orders by date and hour, then field and group, with the undated last", () => {
      const sorted = sortSwapCandidates([
        make(1, null, null, "Grupo B", 2),
        make(2, "2027-01-10T08:00:00", "Cancha 1", "Grupo A", 2),
        make(3, "2027-01-03T09:00:00", "Cancha 1", "Grupo A", 1),
        make(4, "2027-01-03T08:00:00", "Cancha 2", "Grupo B", 1),
        make(5, "2027-01-03T08:00:00", "Cancha 1", "Grupo B", 1),
        make(6, null, null, "Grupo A", 1),
        make(7, "2027-01-03T08:00:00", "Cancha 1", "Grupo A", 1),
      ]);

      expect(sorted.map((match) => match.id)).toEqual([7, 5, 4, 3, 2, 6, 1]);
    });
  });

  describe("busyReasonLabel", () => {
    it("reorders the busy referee reason", () => {
      expect(
        busyReasonLabel("Ocupado en Rayos vs Dragones (Dom 03/01, 8:00 a.m.)."),
      ).toBe("Ocupado · Rayos vs Dragones — Dom 03/01, 8:00 a.m.");
    });

    it("keeps any other reason as it comes", () => {
      expect(busyReasonLabel("Sin disponibilidad")).toBe("Sin disponibilidad");
    });
  });
});
