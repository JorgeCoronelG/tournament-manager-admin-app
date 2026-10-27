import { byField, cardBox, hourRange, minutesOf } from "./agenda.model";

const match = (id: number, start: string, end: string, field: number | null) =>
  ({
    id,
    match_datetime: start,
    end_datetime: end,
    field: field === null ? null : { id: field, name: `Cancha ${field}` },
  }) as never;

describe("agenda.model", () => {
  it("reads the wall clock of an ISO date", () => {
    expect(minutesOf("2026-11-07T08:30:00-06:00")).toBe(510);
  });

  it("sizes a card by the length of the match", () => {
    const box = cardBox(
      {
        match_datetime: "2026-11-07T09:00:00",
        end_datetime: "2026-11-07T10:00:00",
      },
      8,
    );

    expect(box.height).toBeCloseTo(box.top);
    expect(box.top).toBeGreaterThan(0);
  });

  it("covers the matches with an hour of margin", () => {
    expect(
      hourRange([
        {
          match_datetime: "2026-11-07T09:30:00",
          end_datetime: "2026-11-07T10:30:00",
        },
      ]),
    ).toEqual({ first: 8, last: 12 });
    expect(hourRange([])).toEqual({ first: 8, last: 20 });
  });

  it("splits the matches by field, in order of hour", () => {
    const columns = byField([
      match(1, "2026-11-07T10:00:00", "2026-11-07T11:00:00", 1),
      match(2, "2026-11-07T09:00:00", "2026-11-07T10:00:00", 1),
      match(3, "2026-11-07T09:00:00", "2026-11-07T10:00:00", null),
    ]);

    expect(columns.get(1)?.map((m) => m.id)).toEqual([2, 1]);
    expect(columns.get(null)?.map((m) => m.id)).toEqual([3]);
  });
});
