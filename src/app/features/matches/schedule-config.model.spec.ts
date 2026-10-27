import {
  alignEnd,
  clampWindows,
  overlappingWindows,
} from "./schedule-config.model";

describe("alignEnd", () => {
  it("keeps an end that is a whole number of matches after the start", () => {
    expect(alignEnd("09:00", "14:00", 60)).toBe("14:00");
  });

  it("moves an end that no longer lines up to the next one", () => {
    expect(alignEnd("09:30", "14:00", 60)).toBe("14:30");
    expect(alignEnd("08:20", "12:00", 45)).toBe("12:05");
  });

  it("puts the end one match after a start that is not before it", () => {
    expect(alignEnd("15:00", "14:00", 60)).toBe("16:00");
    expect(alignEnd("14:00", "14:00", 90)).toBe("15:30");
  });

  it("keeps the number of matches when the start moves back and forth", () => {
    expect(alignEnd("08:15", "13:00", 60, "08:00")).toBe("13:15");
    expect(alignEnd("08:00", "13:15", 60, "08:15")).toBe("13:00");
  });

  it("empties it when no whole match fits before midnight", () => {
    expect(alignEnd("23:30", "23:45", 60)).toBe("");
  });

  it("leaves it alone without a valid start, end or duration", () => {
    expect(alignEnd("", "14:00", 60)).toBe("14:00");
    expect(alignEnd("09:00", "", 60)).toBe("");
    expect(alignEnd("09:00", "14:00", 0)).toBe("14:00");
  });
});

describe("clampWindows", () => {
  const day = { start: "08:00", end: "11:00" };

  it("cuts the ends that fall outside the day", () => {
    expect(clampWindows([{ start: "07:00", end: "12:00" }], day)).toEqual([
      { start: "08:00", end: "11:00" },
    ]);
  });

  it("keeps the windows already inside, and drops the ones left with no time", () => {
    expect(
      clampWindows(
        [
          { start: "08:00", end: "09:00" },
          { start: "11:00", end: "12:00" },
        ],
        day,
      ),
    ).toEqual([{ start: "08:00", end: "09:00" }]);
  });

  it("leaves everything alone while the day has no valid hours", () => {
    const windows = [{ start: "08:00", end: "12:00" }];

    expect(clampWindows(windows, { start: "08:00", end: "" })).toBe(windows);
  });
});

describe("overlappingWindows", () => {
  it("marca las ventanas que se empalman", () => {
    expect(
      overlappingWindows([
        { start: "09:00", end: "13:00" },
        { start: "12:00", end: "13:00" },
        { start: "14:00", end: "15:00" },
      ]),
    ).toEqual([true, true, false]);
  });

  it("no marca ventanas contiguas", () => {
    expect(
      overlappingWindows([
        { start: "09:00", end: "10:00" },
        { start: "10:00", end: "11:00" },
      ]),
    ).toEqual([false, false]);
  });
});
