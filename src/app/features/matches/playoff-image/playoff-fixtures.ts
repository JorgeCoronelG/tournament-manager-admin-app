import {
  BracketMatch,
  BracketRound,
  BracketTeam,
  BracketTie,
} from "../playoff.model";

export const team = (id: number, name: string): BracketTeam => ({
  registration_id: id,
  team_id: id,
  team_name: name,
  logo_url: null,
});

export const bracketMatch = (
  id: number,
  overrides: Partial<BracketMatch> = {},
): BracketMatch => ({
  id,
  leg: null,
  scheduled_date: null,
  match_datetime: "2026-11-28T08:00:00",
  field: { id: 1, name: "Cancha 1" },
  referee: { id: 1, name: "Luis Pérez" },
  home_team: team(1, "Halcones"),
  away_team: team(2, "Tigres"),
  home_goals: null,
  away_goals: null,
  home_penalties: null,
  away_penalties: null,
  status: "scheduled",
  ...overrides,
});

export const tie = (
  matches: BracketMatch[],
  overrides: Partial<BracketTie> = {},
): BracketTie => ({
  id: 1,
  round_index: 0,
  bracket_position: 1,
  team_a: team(1, "Halcones"),
  team_b: team(2, "Tigres"),
  seed_a: 1,
  seed_b: 4,
  matches,
  aggregate: null,
  winner_team_id: null,
  winner_registration_id: null,
  decided_by: null,
  ...overrides,
});

export const round = (
  ties: BracketTie[],
  legs: 1 | 2 = 1,
  name = "Semifinal",
): BracketRound => ({ index: 0, name, legs, ties });
