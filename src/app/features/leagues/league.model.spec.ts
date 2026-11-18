import { exceedsLimit, LeagueLimits, tournamentsReached } from "./league.model";

const limits = (maxTournaments: number | null): LeagueLimits => ({
  max_active_tournaments: maxTournaments,
  usage: {
    active_tournaments: 2,
    tournaments: [
      { id: 1, name: "A", status: "in_progress", active_registrations: 6 },
      { id: 2, name: "B", status: "playoffs", active_registrations: 16 },
    ],
  },
});

describe("league limits", () => {
  it("blocks a new tournament only at the limit, never without one", () => {
    expect(tournamentsReached(limits(2))).toBe(true);
    expect(tournamentsReached(limits(3))).toBe(false);
    expect(tournamentsReached(limits(null))).toBe(false);
  });

  it("tells when the limit being set is below what the league uses", () => {
    const { usage } = limits(null);

    expect(exceedsLimit(usage, 1)).toBe(true);
    expect(exceedsLimit(usage, 2)).toBe(false);
    expect(exceedsLimit(usage, null)).toBe(false);
  });
});
