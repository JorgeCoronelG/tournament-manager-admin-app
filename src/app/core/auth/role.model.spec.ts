import { toRoles } from "./role.model";

describe("toRoles", () => {
  it("keeps the known roles and drops anything else", () => {
    expect(toRoles(["league_admin", "hacker", "player"])).toEqual([
      "league_admin",
      "player",
    ]);
  });

  it("returns no roles when the backend sends none", () => {
    expect(toRoles(undefined)).toEqual([]);
    expect(toRoles([])).toEqual([]);
  });
});
