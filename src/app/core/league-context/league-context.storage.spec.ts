import {
  readActiveLeagueId,
  writeActiveLeagueId,
} from "./league-context.storage";

describe("league context storage", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("reads nothing when nothing was saved", () => {
    expect(readActiveLeagueId(1)).toBeNull();
  });

  it("writes and reads the id under a key per user", () => {
    writeActiveLeagueId(1, 5);
    writeActiveLeagueId(2, 8);

    expect(localStorage.getItem("app.active-league.1")).toBe("5");
    expect(readActiveLeagueId(1)).toBe(5);
    expect(readActiveLeagueId(2)).toBe(8);
    expect(readActiveLeagueId(3)).toBeNull();
  });

  it("removes the id when written as null", () => {
    writeActiveLeagueId(1, 5);
    writeActiveLeagueId(1, null);

    expect(readActiveLeagueId(1)).toBeNull();
  });

  it("ignores a stored value that is not an id", () => {
    localStorage.setItem("app.active-league.1", "abc");
    expect(readActiveLeagueId(1)).toBeNull();

    localStorage.setItem("app.active-league.1", "-3");
    expect(readActiveLeagueId(1)).toBeNull();
  });

  it("survives a localStorage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readActiveLeagueId(1)).toBeNull();
    expect(() => writeActiveLeagueId(1, 5)).not.toThrow();
    expect(() => writeActiveLeagueId(1, null)).not.toThrow();
  });
});
