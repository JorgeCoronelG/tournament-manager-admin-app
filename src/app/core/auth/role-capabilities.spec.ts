import { capabilitiesFor } from "./role-capabilities";

describe("capabilitiesFor", () => {
  it("gives the superadmin everything, including user management", () => {
    expect(capabilitiesFor(["superadmin"]).has("users.manage")).toBe(true);
    expect(capabilitiesFor(["superadmin"]).has("leagues.manage")).toBe(true);
  });

  it("lets the superadmin and the league admin pick the active league", () => {
    expect(capabilitiesFor(["superadmin"]).has("leagues.select")).toBe(true);
    expect(capabilitiesFor(["league_admin"]).has("leagues.select")).toBe(true);
    expect(
      capabilitiesFor(["referee", "manager", "player"]).has("leagues.select"),
    ).toBe(false);
  });

  it("keeps the league admin out of users and leagues", () => {
    const capabilities = capabilitiesFor(["league_admin"]);

    expect(capabilities.has("tournaments.manage")).toBe(true);
    expect(capabilities.has("users.manage")).toBe(false);
    expect(capabilities.has("leagues.manage")).toBe(false);
  });

  it("lets the superadmin and the league admin manage fields", () => {
    expect(capabilitiesFor(["superadmin"]).has("fields.manage")).toBe(true);
    expect(capabilitiesFor(["league_admin"]).has("fields.manage")).toBe(true);
    expect(capabilitiesFor(["referee", "manager"]).has("fields.manage")).toBe(
      false,
    );
  });

  it("lets the superadmin and the league admin manage teams", () => {
    expect(capabilitiesFor(["superadmin"]).has("teams.manage")).toBe(true);
    expect(capabilitiesFor(["league_admin"]).has("teams.manage")).toBe(true);
    expect(capabilitiesFor(["referee", "manager"]).has("teams.manage")).toBe(
      false,
    );
  });

  it("gives the roles used from the mobile app no panel capabilities", () => {
    expect(capabilitiesFor(["referee", "manager", "player"]).size).toBe(0);
  });

  it("merges the capabilities of several roles", () => {
    const capabilities = capabilitiesFor(["player", "league_admin"]);

    expect(capabilities.has("matches.manage")).toBe(true);
  });
});
