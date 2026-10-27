export type ScheduleMode = "balanced" | "random";
export type ScheduleScope = "all" | "unscheduled";

export interface ScheduleOptions {
  mode: ScheduleMode;
  scope: ScheduleScope;
  /** Draw of the random mode: sending the previewed one assigns exactly what was shown */
  seed?: number | null;
}

export interface SchedulePreviewMatchday {
  matchday: number;
  /** Y-m-d; null with no week left for the matchday */
  week_start: string | null;
  week_end: string | null;
  matches: number;
  scheduled: number;
  unscheduled: number;
}

export interface ScheduleWarning {
  matchday: number;
  unscheduled: number;
  message: string;
}

export interface ScheduleProposal {
  id: number;
  matchday: number;
  group: string | null;
  home_team: string | null;
  away_team: string | null;
  /** `Y-m-dTH:mm:ss`; null when the match gets no slot */
  match_datetime: string | null;
  field: { id: number; name: string | null } | null;
}

/** `POST /schedule/preview` (and `/generate`, which answers the same) */
export interface SchedulePreview {
  /** Draw the random mode used; null in the balanced one */
  seed: number | null;
  scheduled: number;
  unscheduled: number;
  locked_kept: number;
  played_kept: number;
  assigned_kept: number;
  matchdays: SchedulePreviewMatchday[];
  warnings: ScheduleWarning[];
  matches: ScheduleProposal[];
}

/** `DELETE /schedule` */
export interface ClearResult {
  cleared: number;
}

/** ISO ("Y-m-dTH:mm…") → ISO weekday (1 = Monday), "dd/MM" and 12-hour time; the wall clock is kept as written */
export function slotParts(iso: string): {
  weekday: number;
  date: string;
  time: string;
} {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const [hours, minutes] = iso.slice(11, 16).split(":").map(Number);
  const weekday = ((new Date(year, month - 1, day).getDay() + 6) % 7) + 1;
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    weekday,
    date: `${pad(day)}/${pad(month)}`,
    time: `${hours % 12 || 12}:${pad(minutes)} ${hours < 12 ? "a.m." : "p.m."}`,
  };
}

/** "Sáb 07/11 · 8:00 a.m. · Cancha 1"; `weekdayName` is the full name of the weekday */
export function slotLabel(
  iso: string,
  field: string | null | undefined,
  weekdayName: (weekday: number) => string,
): string {
  const { weekday, date, time } = slotParts(iso);

  return [`${weekdayName(weekday).slice(0, 3)} ${date}`, time, field]
    .filter(Boolean)
    .join(" · ");
}

/** "02/11 - 08/11" for the first and last day of the matches that have a date; null when none has */
export function datesRange(
  matches: ReadonlyArray<{ match_datetime: string | null }>,
): string | null {
  const dates = matches
    .map((match) => match.match_datetime)
    .filter((date): date is string => !!date)
    .sort();

  if (!dates.length) {
    return null;
  }

  const short = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

  return `${short(dates[0])} - ${short(dates[dates.length - 1])}`;
}
