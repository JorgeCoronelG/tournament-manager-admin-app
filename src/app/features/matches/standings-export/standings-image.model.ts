import { formatDate } from "@angular/common";
import { StandingGroup, StandingPlayoff } from "../match.model";
import { colorByPriority } from "../standings-view/playoff-palette";

/** A team of the exported table */
export interface ImageRow {
  position: number;
  team_name: string;
  logo_url: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  /** Class of the bar next to the position; null when the team does not qualify or it is still to be defined */
  bar: string | null;
}

export interface ImageLegendItem {
  label: string;
  bar: string;
  chip: string;
}

/** Everything the exported image shows */
export interface StandingsImageData {
  leagueName: string;
  tournamentName: string;
  /** Only when the tournament has several groups */
  groupName: string | null;
  /** The matchday reached: the most played by any team (0 before the first one) */
  matchday: number;
  /** dd/MM/yyyy */
  updated: string;
  legend: ImageLegendItem[];
  rows: ImageRow[];
  tiesPending: boolean;
}

/** "Torneo Cuatro" -> "torneo-cuatro": lower case, no accents, hyphens for anything else */
export function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** posiciones-{torneo}-{grupo}-{yyyy-MM-dd}.png, without the group when there is a single one */
export function exportFileName(
  tournamentName: string,
  groupName: string | null,
  date: Date,
): string {
  return `${[
    "posiciones",
    slug(tournamentName),
    groupName ? slug(groupName) : "",
    formatDate(date, "yyyy-MM-dd", "en-US"),
  ]
    .filter(Boolean)
    .join("-")}.png`;
}

/** The data of the image of a group's table, as the screen shows it */
export function buildImageData(input: {
  leagueName: string;
  tournamentName: string;
  group: StandingGroup;
  groupsCount: number;
  playoffs: readonly StandingPlayoff[];
  now: Date;
  /** Text of each legend item, "Finales (1-2)" */
  legendLabel: (playoff: StandingPlayoff) => string;
}): StandingsImageData {
  const colors = colorByPriority(input.playoffs);
  const byId = new Map(colors.map((item) => [item.playoff.id, item.color]));

  return {
    leagueName: input.leagueName,
    tournamentName: input.tournamentName,
    groupName: input.groupsCount > 1 ? input.group.group_name : null,
    matchday: Math.max(0, ...input.group.rows.map((row) => row.played)),
    updated: formatDate(input.now, "dd/MM/yyyy", "en-US"),
    legend: colors.map(({ playoff, color }) => ({
      label: input.legendLabel(playoff),
      bar: color.barLight,
      chip: color.chipLight,
    })),
    rows: input.group.rows.map((row) => ({
      position: row.position,
      team_name: row.team_name,
      logo_url: row.logo_url,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goals_for: row.goals_for,
      goals_against: row.goals_against,
      goal_difference: row.goal_difference,
      points: row.points,
      bar:
        row.playoff && !row.playoff_pending
          ? (byId.get(row.playoff.id)?.barLight ?? null)
          : null,
    })),
    tiesPending: input.group.ties_pending === true,
  };
}
