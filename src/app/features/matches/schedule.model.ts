import { escapeHtml } from "../../shared/confirm-dialog/confirm-dialog.service";
export type ScheduleMode = "balanced" | "random";
export type ScheduleScope = "all" | "unscheduled";

export interface ScheduleOptions {
  /** Regular phase only */
  mode?: ScheduleMode;
  scope: ScheduleScope;
  /** Draw of the random mode: sending the previewed one assigns exactly what was shown */
  seed?: number | null;
  /** "playoffs" assigns the bracket's matches; by default the regular phase */
  phase?: SchedulePhase;
  /** Playoffs: the finals are scheduled together at the end of the day */
  align_finals?: boolean;
}

export type SchedulePhase = "regular" | "playoffs";

/** A round of the playoffs in the preview */
export interface PlayoffPreviewRound {
  liguilla: string | null;
  round_name: string;
  /** 1 or 2 (home and away) in a two-legged round; null for one match */
  leg: number | null;
  /** Y-m-d */
  date: string | null;
  matches: number;
  scheduled: number;
  unscheduled: number;
}

export interface SchedulePreviewMatchday {
  matchday: number;
  /** Y-m-d; null with no week left for the matchday */
  week_start: string | null;
  week_end: string | null;
  matches: number;
  scheduled: number;
  unscheduled: number;
  occupied_by_others?: OccupiedSlot[];
}

/** A slot of a field that a match of another tournament takes */
export interface OccupiedSlot {
  /** Y-m-d */
  date: string;
  field_id: number;
  field_name: string | null;
  start_time: string;
  end_time: string;
  tournament_id: number;
  tournament_name: string | null;
}

export interface ScheduleWarning {
  /** "slot_taken": a match lost its slot while it was assigned */
  code?: string;
  match?: ScheduleProposal;
  occupied_by?: Omit<OccupiedSlot, "date" | "start_time" | "end_time">;
  /** Regular phase */
  matchday?: number;
  /** Playoffs: Y-m-d, null with no date */
  date?: string | null;
  round_name?: string;
  liguilla?: string | null;
  unscheduled: number;
  message: string;
}

export interface ScheduleProposal {
  id: number;
  /** Null in the playoffs */
  matchday: number | null;
  group: string | null;
  /** Playoffs */
  round_name?: string;
  leg?: number | null;
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
  /** Playoffs: one row per round and date */
  rounds?: PlayoffPreviewRound[];
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

/**
 * One line per amount of missing slots, the largest first, with the matchdays
 * (in order) that miss that amount: "Faltan 2 espacios en la jornada 1.",
 * "Falta 1 espacio en las jornadas 2, 3 y 4."
 */
export function deficitLines(
  days: ReadonlyArray<{ matchday: number; deficit: number }>,
  translate: (key: string, params?: Record<string, unknown>) => string,
): string[] {
  const byDeficit = new Map<number, number[]>();

  for (const day of days) {
    if (day.deficit > 0) {
      byDeficit.set(day.deficit, [
        ...(byDeficit.get(day.deficit) ?? []),
        day.matchday,
      ]);
    }
  }

  const where = (matchdays: number[]): string => {
    const list =
      matchdays.length === 1
        ? `${matchdays[0]}`
        : `${matchdays.slice(0, -1).join(", ")} ${translate("matches.config.capacity.and")} ${matchdays.at(-1)}`;

    return translate(
      matchdays.length === 1
        ? "matches.config.capacity.matchdayOne"
        : "matches.config.capacity.matchdayMany",
      { list },
    );
  };

  return [...byDeficit.entries()]
    .sort(([a], [b]) => b - a)
    .map(([deficit, matchdays]) =>
      translate(
        deficit === 1
          ? "matches.config.capacity.missingOne"
          : "matches.config.capacity.missingMany",
        {
          count: deficit,
          where: where([...matchdays].sort((a, b) => a - b)),
        },
      ),
    );
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** "08:00" → "8:00 a.m.", "15:30" → "3:30 p.m." */
const shortClock = (clock: string): string => {
  const [hours, minutes] = clock.split(":").map(Number);

  // Non-breaking space: the "a.m." never ends up alone on the next line
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")}\u00a0${hours < 12 ? "a.m." : "p.m."}`;
};

/** "1, 2 y 3" with `and` before the last one */
function joinList(items: string[], and: string): string {
  return items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} ${and} ${items.at(-1)}`;
}

/** [1, 2, 3, 4, 5] → "1 a 5"; [1, 3, 4] → "1, 3 y 4" (a run of three or more becomes a range) */
function matchdaysList(
  matchdays: number[],
  translate: Translate,
  rangeKey = "matches.config.capacity.range",
): string {
  const parts: string[] = [];

  for (let i = 0; i < matchdays.length;) {
    let end = i;

    while (matchdays[end + 1] === matchdays[end] + 1) {
      end++;
    }

    if (end - i >= 2) {
      parts.push(
        translate(rangeKey, {
          from: matchdays[i],
          to: matchdays[end],
        }),
      );
      i = end + 1;
    } else {
      parts.push(`${matchdays[i]}`);
      i++;
    }
  }

  return joinList(parts, translate("matches.config.capacity.and"));
}

interface OccupiedGroup {
  slot: OccupiedSlot;
  weekday: number;
  matchdays: number[];
  /** Chronological; the ones that touch or overlap are one */
  intervals: Array<{ start: string; end: string }>;
}

type DaysWithOccupied = ReadonlyArray<{
  matchday: number;
  occupied_by_others?: readonly OccupiedSlot[];
}>;

/**
 * What other tournaments take: one group per tournament, field, weekday and
 * set of matchdays, with its times in order and the consecutive ones merged
 * (8:00-9:00 and 9:00-10:00 are 8:00-10:00). Times that do not share the same
 * matchdays stay in separate groups.
 */
function groupOccupied(days: DaysWithOccupied): OccupiedGroup[] {
  const slots = new Map<
    string,
    { slot: OccupiedSlot; weekday: number; matchdays: Set<number> }
  >();

  for (const day of days) {
    for (const slot of day.occupied_by_others ?? []) {
      const weekday = slotParts(`${slot.date}T00:00`).weekday;
      const key = [
        slot.tournament_id,
        slot.field_id,
        weekday,
        slot.start_time,
        slot.end_time,
      ].join("|");
      const found = slots.get(key) ?? {
        slot,
        weekday,
        matchdays: new Set<number>(),
      };

      found.matchdays.add(day.matchday);
      slots.set(key, found);
    }
  }

  const groups = new Map<string, OccupiedGroup>();
  const ordered = [...slots.values()].sort((a, b) =>
    a.slot.start_time.localeCompare(b.slot.start_time),
  );

  for (const { slot, weekday, matchdays } of ordered) {
    const list = [...matchdays].sort((a, b) => a - b);
    const key = [
      slot.tournament_id,
      slot.field_id,
      weekday,
      list.join(","),
    ].join("|");
    const group = groups.get(key) ?? {
      slot,
      weekday,
      matchdays: list,
      intervals: [],
    };
    const last = group.intervals.at(-1);

    if (last && slot.start_time <= last.end) {
      last.end = slot.end_time > last.end ? slot.end_time : last.end;
    } else {
      group.intervals.push({ start: slot.start_time, end: slot.end_time });
    }
    groups.set(key, group);
  }

  return [...groups.values()];
}

/**
 * One sentence per tournament, field, weekday and matchdays:
 * "La Cancha 1 está ocupada por Torneo Uno los domingos de 8:00 a.m. a 9:00 a.m.
 * y de 11:00 a.m. a 12:00 p.m. (jornadas 1 a 5)."
 */
export function occupiedLines(
  days: DaysWithOccupied,
  translate: Translate,
): string[] {
  const and = translate("matches.config.capacity.and");

  return groupOccupied(days).map(({ slot, weekday, matchdays, intervals }) =>
    translate("matches.config.capacity.occupiedLine", {
      field: slot.field_name ?? "",
      tournament: slot.tournament_name ?? "",
      days: translate(`matches.config.weekdaysOn.${weekday}`),
      intervals: joinList(
        intervals.map((interval) =>
          translate("matches.config.capacity.occupiedInterval", {
            start: shortClock(interval.start),
            end: shortClock(interval.end),
          }),
        ),
        and,
      ),
      matchdays: translate(
        matchdays.length === 1
          ? "matches.config.capacity.lineMatchdayOne"
          : "matches.config.capacity.lineMatchdayMany",
        { list: matchdaysList(matchdays, translate) },
      ),
    }),
  );
}

/** What a tournament takes of a field: "Dom. 8:00 a.m. - 9:00 a.m." and "Jornadas 1–5" */
export interface OccupiedCardGroup {
  key: string;
  field: string;
  tournament: string;
  slots: Array<{ key: string; when: string; matchdays: string }>;
}

/** The occupied slots for a card: one group per field and tournament, its rows by weekday and time */
export function occupiedGroups(
  days: DaysWithOccupied,
  translate: Translate,
): OccupiedCardGroup[] {
  const groups = new Map<string, OccupiedCardGroup>();
  const and = translate("matches.config.capacity.and");
  const sorted = groupOccupied(days).sort(
    (a, b) =>
      a.weekday - b.weekday ||
      a.intervals[0].start.localeCompare(b.intervals[0].start),
  );

  for (const { slot, weekday, matchdays, intervals } of sorted) {
    const key = `${slot.field_id}|${slot.tournament_id}`;
    const group = groups.get(key) ?? {
      key,
      field: slot.field_name ?? "",
      tournament: slot.tournament_name ?? "",
      slots: [],
    };
    const name = translate(`matches.config.weekdays.${weekday}`);

    group.slots.push({
      key: `${weekday}|${intervals[0].start}|${matchdays.join(",")}`,
      when: `${name.slice(0, 3)}. ${joinList(
        intervals.map(
          (interval) =>
            `${shortClock(interval.start)} - ${shortClock(interval.end)}`,
        ),
        and,
      )}`,
      matchdays: translate(
        matchdays.length === 1
          ? "matches.config.capacity.occupiedMatchdayOne"
          : "matches.config.capacity.occupiedMatchdayMany",
        {
          list: matchdaysList(
            matchdays,
            translate,
            "matches.config.capacity.occupiedRange",
          ),
        },
      ),
    });
    groups.set(key, group);
  }

  return [...groups.values()].sort(
    (a, b) =>
      a.field.localeCompare(b.field) ||
      a.tournament.localeCompare(b.tournament),
  );
}

/** A window of another tournament that coincides with the configuration */
export interface ConfigOverlap {
  tournament_id: number;
  tournament_name: string | null;
  field_id: number;
  field_name: string | null;
  /** 1 (Monday) to 7 (Sunday) */
  weekday: number;
  start_time: string;
  end_time: string;
}

/**
 * One line per tournament and field, as HTML (the names are escaped):
 * "La <b>Cancha 1</b> también está configurada para el <b>Torneo Uno</b> los
 * domingos de <b>8:00 a.m. a 10:00 a.m.</b>."
 */
export function overlapLines(
  overlaps: readonly ConfigOverlap[],
  translate: Translate,
): string[] {
  const groups = new Map<string, ConfigOverlap[]>();

  for (const overlap of overlaps) {
    const key = `${overlap.tournament_id}|${overlap.field_id}`;

    groups.set(key, [...(groups.get(key) ?? []), overlap]);
  }

  return [...groups.values()].map((items) => {
    const when = items.map((item) =>
      translate("matches.config.overlaps.when", {
        day: translate(`matches.config.weekdaysOn.${item.weekday}`),
        start: shortClock(item.start_time),
        end: shortClock(item.end_time),
      }),
    );

    return translate("matches.config.overlaps.line", {
      field: escapeHtml(items[0].field_name ?? ""),
      tournament: escapeHtml(items[0].tournament_name ?? ""),
      when: joinList(when, translate("matches.config.capacity.and")),
    }).replace(/\.\.$/, ".");
  });
}
