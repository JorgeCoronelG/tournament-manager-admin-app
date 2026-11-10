/** Time of day, 24 h `HH:mm` */
export type Clock = string;

/** A weekday as the backend numbers it: 1 (Monday) to 7 (Sunday) */
export const WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isClock(value: string): boolean {
  return CLOCK.test(value);
}

/** `HH:mm` to a date today at that time (what the timepicker holds); null when empty or invalid */
export function clockToDate(value: Clock): Date | null {
  if (!isClock(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();

  date.setHours(hours, minutes, 0, 0);

  return date;
}

/** The time of a date as `HH:mm` (24 h) */
export function dateToClock(date: Date): Clock {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Minutes since midnight of a valid `HH:mm` */
export function clockMinutes(value: Clock): number {
  const [hours, minutes] = value.split(":").map(Number);

  return hours * 60 + minutes;
}

/** `HH:mm` of minutes since midnight */
export function minutesToClock(minutes: number): Clock {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * The end of a window once its start changed. A window whose end was a whole
 * number of matches after its previous start keeps that number of matches
 * (8:15-13:15 back to 8:00 gives 13:00). Otherwise the end moves to the next
 * one on the grid after it (start 9:30, end 14:00, 60 min: 14:30), or one
 * match after the start when it is not later than it. Empty when none fits.
 */
export function alignEnd(
  start: Clock,
  end: Clock,
  minutes: number,
  previousStart: Clock = "",
): Clock {
  if (!isClock(start) || !isClock(end) || !(minutes > 0)) {
    return end;
  }

  const from = clockMinutes(start);
  const to = clockMinutes(end);
  const before = isClock(previousStart) ? clockMinutes(previousStart) : null;
  let matches: number;

  if (before !== null && to > before && (to - before) % minutes === 0) {
    matches = (to - before) / minutes;
  } else if (to > from && (to - from) % minutes === 0) {
    return end;
  } else {
    matches = Math.max(1, Math.ceil((to - from) / minutes));
  }

  if (from + matches * minutes >= 24 * 60) {
    matches = Math.floor((24 * 60 - 1 - from) / minutes);
  }

  return matches < 1 ? "" : minutesToClock(from + matches * minutes);
}

/**
 * The windows of a field cut to the day's range: a start before the day's start
 * moves up to it, an end after the day's end moves back to it, and a window
 * left with no time at all is dropped. Windows that are not complete yet stay.
 */
export function clampWindows(
  windows: TimeWindow[],
  day: Pick<TimeWindow, "start" | "end">,
): TimeWindow[] {
  if (!isClock(day.start) || !isClock(day.end)) {
    return windows;
  }

  const from = clockMinutes(day.start);
  const to = clockMinutes(day.end);

  return windows.flatMap((window) => {
    if (!isClock(window.start) || !isClock(window.end)) {
      return [window];
    }

    const start = Math.max(clockMinutes(window.start), from);
    const end = Math.min(clockMinutes(window.end), to);

    return end > start
      ? [{ start: minutesToClock(start), end: minutesToClock(end) }]
      : [];
  });
}

/** A window is valid when both ends are `HH:mm` and the end is after the start */
export function validWindow(window: TimeWindow): boolean {
  return (
    isClock(window.start) &&
    isClock(window.end) &&
    clockMinutes(window.end) > clockMinutes(window.start)
  );
}

/**
 * The window has room for at least one whole match. True while the window or
 * the duration is not set (other rules say so then).
 */
export function fitsMatch(window: TimeWindow, minutes: number | null): boolean {
  if (!minutes || !validWindow(window)) {
    return true;
  }

  return clockMinutes(window.end) - clockMinutes(window.start) >= minutes;
}

/** Flags (by index) the valid windows that overlap another valid window */
export function overlappingWindows(windows: TimeWindow[]): boolean[] {
  return windows.map(
    (window, i) =>
      validWindow(window) &&
      windows.some(
        (other, j) =>
          i !== j &&
          validWindow(other) &&
          clockMinutes(window.start) < clockMinutes(other.end) &&
          clockMinutes(other.start) < clockMinutes(window.end),
      ),
  );
}

export interface TimeWindow {
  start: Clock;
  end: Clock;
}

/** One field's windows within a play day */
export interface FieldWindows {
  field_id: number;
  windows: TimeRange[];
  /** Touched by hand: changing the day's default no longer overwrites it */
  edited: boolean;
}

export interface PlayDay {
  weekday: number;
  /** What the timepicker holds (today at that time); null while empty */
  start: Date | null;
  end: Date | null;
  /** The fields picked for the day: what the select edits; `fields` follows it */
  field_ids: number[];
  fields: FieldWindows[];
}

/** A start and an end as the timepickers hold them (null while empty) */
export interface TimeRange {
  start: Date | null;
  end: Date | null;
}

/** A window of `HH:mm` texts as the timepickers' dates */
export function toRange(window: TimeWindow): TimeRange {
  return { start: clockToDate(window.start), end: clockToDate(window.end) };
}

/** The hours of a range (a day, a window) as `HH:mm` ("" while empty) */
export function dayClocks(day: TimeRange): TimeWindow {
  return {
    start: day.start ? dateToClock(day.start) : "",
    end: day.end ? dateToClock(day.end) : "",
  };
}

export interface BlockedDate {
  /** Date picked in the calendar */
  date: Date | null;
  /** "" means every field */
  field_id: number | "";
  /** Both empty: the whole day */
  start: Date | null;
  end: Date | null;
  reason: string;
}

export interface ScheduleConfigModel {
  start_date: Date | null;
  days: PlayDay[];
  blocks: BlockedDate[];
}

/** A field as the API nests it */
export interface FieldRef {
  id: number;
  name: string;
}

/** Window as GET /schedule-config returns it */
export interface ConfigWindow {
  weekday: number;
  field: FieldRef;
  start_time: Clock;
  end_time: Clock;
}

/** Block as GET returns it (`field` null: every field) */
export interface ConfigBlock {
  /** Y-m-d */
  date: string;
  field: FieldRef | null;
  /** null both: the whole day */
  start_time: Clock | null;
  end_time: Clock | null;
  reason: string | null;
}

/** What GET /schedule-config returns */
export interface ScheduleConfig {
  /** Y-m-d */
  schedule_start_date: string | null;
  windows: ConfigWindow[];
  blocks: ConfigBlock[];
  /** Length of the matches, set in the tournament's management */
  match_duration_minutes: number | null;
}

/** Body of the PUT: the fields go by `field_id` */
export interface ScheduleConfigBody {
  schedule_start_date: string | null;
  windows: Array<{
    weekday: number;
    field_id: number;
    start_time: Clock;
    end_time: Clock;
  }>;
  blocks: Array<{
    date: string;
    field_id: number | null;
    start_time: Clock | null;
    end_time: Clock | null;
    reason: string | null;
  }>;
}

export interface MatchdayCapacity {
  matchday: number;
  /** Week it is played in; null with no week left for it */
  week: number | null;
  /** Y-m-d, null when it has no week */
  start_date: string | null;
  end_date: string | null;
  matches_required: number;
  slots_available: number;
  deficit: number;
}

export interface CapacityWeek {
  week: number;
  start_date: string;
  end_date: string;
  slots_total: number;
  /** No slots that week: no matchday is played in it */
  blocked: boolean;
  /** Matchday played that week (only with a pairing calendar) */
  matchday: number | null;
}

/** A round of the playoffs and the slots its date has */
export interface PlayoffRoundCapacity {
  liguilla: string | null;
  round_name: string;
  leg: number | null;
  /** Y-m-d */
  date: string;
  matches_required: number;
  slots_available: number;
  deficit: number;
}

export interface PlayoffWarning {
  date: string | null;
  liguilla: string | null;
  round_name: string;
  message: string;
}

export interface Capacity {
  /** Only once the playoffs have dates; empty otherwise */
  playoff_rounds?: PlayoffRoundCapacity[];
  playoff_warnings?: PlayoffWarning[];
  weeks: CapacityWeek[];
  /** Empty when there is no pairing calendar */
  matchdays: MatchdayCapacity[];
  has_calendar: boolean;
  schedule_outdated: boolean;
  /** Matches fixed by hand that fall outside the configured hours (absent when the backend does not say) */
  locked_outside_schedule?: number;
}

/** The default windows of a field in a day: a copy of the day's schedule */
export function defaultWindows(day: TimeWindow): TimeRange[] {
  return [toRange(day)];
}

/** Model from the saved configuration */
export function toModel(
  config: ScheduleConfig,
  parseDate: (value: string) => Date,
): ScheduleConfigModel {
  const days: Array<{
    weekday: number;
    start: Clock;
    end: Clock;
    fields: Array<{
      field_id: number;
      windows: TimeWindow[];
      edited: boolean;
    }>;
  }> = [];

  for (const window of [...config.windows].sort(
    (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time),
  )) {
    let day = days.find((item) => item.weekday === window.weekday);

    if (!day) {
      day = {
        weekday: window.weekday,
        start: window.start_time,
        end: window.end_time,
        fields: [],
      };
      days.push(day);
    }

    let field = day.fields.find((item) => item.field_id === window.field.id);

    if (!field) {
      field = { field_id: window.field.id, windows: [], edited: false };
      day.fields.push(field);
    }

    field.windows.push({ start: window.start_time, end: window.end_time });
  }

  // The day's default is the earliest start and latest end of its windows;
  // a field that differs from a copy of it was edited by hand
  for (const day of days) {
    const all = day.fields.flatMap((field) => field.windows);

    day.start = all.map((w) => w.start).sort()[0] ?? day.start;
    day.end =
      all
        .map((w) => w.end)
        .sort()
        .at(-1) ?? day.end;

    for (const field of day.fields) {
      field.edited = !(
        field.windows.length === 1 &&
        field.windows[0].start === day.start &&
        field.windows[0].end === day.end
      );
    }
  }

  return {
    start_date: config.schedule_start_date
      ? parseDate(config.schedule_start_date)
      : null,
    days: days.map((day) => ({
      weekday: day.weekday,
      start: clockToDate(day.start),
      end: clockToDate(day.end),
      field_ids: day.fields.map((field) => field.field_id),
      fields: day.fields.map((field) => ({
        ...field,
        windows: field.windows.map(toRange),
      })),
    })),
    blocks: config.blocks.map((block) => ({
      date: parseDate(block.date),
      field_id: block.field?.id ?? "",
      start: block.start_time ? clockToDate(block.start_time) : null,
      end: block.end_time ? clockToDate(block.end_time) : null,
      reason: block.reason ?? "",
    })),
  };
}

/** Body of the PUT from the model */
export function toBody(
  model: ScheduleConfigModel,
  formatDate: (date: Date) => string,
): ScheduleConfigBody {
  return {
    schedule_start_date: model.start_date ? formatDate(model.start_date) : null,
    windows: model.days.flatMap((day) =>
      day.fields.flatMap((field) =>
        field.windows.map((window) => ({
          weekday: day.weekday,
          field_id: field.field_id,
          start_time: dayClocks(window).start,
          end_time: dayClocks(window).end,
        })),
      ),
    ),
    blocks: model.blocks.map((block) => ({
      date: formatDate(block.date as Date),
      field_id: block.field_id === "" ? null : block.field_id,
      start_time: block.start ? dateToClock(block.start) : null,
      end_time: block.end ? dateToClock(block.end) : null,
      reason: block.reason.trim() || null,
    })),
  };
}

/** Deduplicated, in order of appearance */
export function uniqueMessages(messages: readonly string[]): string[] {
  return [
    ...new Set(messages.map((message) => message.trim()).filter(Boolean)),
  ];
}
