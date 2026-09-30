import { capabilitiesFor } from "./role-capabilities";

describe("capabilitiesFor", () => {
  it("gives the superadmin everything, including user management", () => {
    expect(capabilitiesFor(["superadmin"]).has("users.manage")).toBe(true);
    expect(capabilitiesFor(["superadmin"]).has("leagues.manage")).toBe(true);
  });

  it("keeps the league admin out of users and leagues", () => {
    const capabilities = capabilitiesFor(["league_admin"]);

    expect(capabilities.has("tournaments.manage")).toBe(true);
    expect(capabilities.has("users.manage")).toBe(false);
    expect(capabilities.has("leagues.manage")).toBe(false);
    expect(capabilities.has("customers.manage")).toBe(false);
  });

  it("gives the roles used from the mobile app no panel capabilities", () => {
    expect(capabilitiesFor(["referee", "manager", "player"]).size).toBe(0);
  });

  it("merges the capabilities of several roles", () => {
    const capabilities = capabilitiesFor(["player", "league_admin"]);

    expect(capabilities.has("matches.manage")).toBe(true);
  });
});
