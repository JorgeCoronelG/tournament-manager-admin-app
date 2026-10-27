import { datesRange, slotLabel, slotParts } from "./schedule.model";

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
