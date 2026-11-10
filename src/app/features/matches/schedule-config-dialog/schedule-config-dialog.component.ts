import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { DatePipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { MatButtonModule } from "@angular/material/button";
import { MatDatepickerModule } from "@angular/material/datepicker";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import {
  MAT_TIMEPICKER_CONFIG,
  MatTimepickerModule,
} from "@angular/material/timepicker";
import { RouterLink } from "@angular/router";
import { MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import {
  applyEach,
  disabled,
  form,
  FormField,
  required,
  validate,
} from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { catchError, throwError } from "rxjs";
import { backendMessage, fieldErrors } from "../../../core/http/api-errors";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { FieldsApi } from "../../fields/fields.api";
import { FieldsQuery } from "../../fields/field.model";
import { formatDate, parseDate } from "../../tournaments/tournament.model";
import { ScheduleConfigApi } from "../schedule-config.api";
import {
  alignEnd,
  clampWindows,
  BlockedDate,
  Capacity,
  PlayoffRoundCapacity,
  MatchdayCapacity,
  clockToDate,
  dateToClock,
  dayClocks,
  defaultWindows,
  fitsMatch,
  isClock,
  PlayDay,
  ScheduleConfigModel,
  TimeWindow,
  toBody,
  toRange,
  toModel,
  uniqueMessages,
  overlappingWindows,
  validWindow,
  WEEKDAYS,
} from "../schedule-config.model";

export interface ScheduleConfigDialogData {
  tournamentId: number;
  /** Minutes the tournament says its matches last (read-only here) */
  matchDuration: number | null;
  /** Y-m-d the tournament starts: the calendar's first date until one is saved */
  tournamentStartDate: string;
}

type TimeChoices = Array<{ label: string; value: Date }> | null;

/** A new day has no hours: the start is chosen first and the end follows from the match length */
/** Windows a folded field names in its header; the rest are counted */
const MAX_RANGES_SHOWN = 2;

const DEFAULT_DAY: Pick<PlayDay, "start" | "end"> = { start: null, end: null };

/**
 * Configures when a tournament plays: first date of the calendar, play days
 * with their hours and fields' windows, and blocked dates. Shows the capacity
 * the saved configuration gives. Closes with `true` once saved.
 */
/** A matchday, or a skipped week (no matchday) */
type CapacityRow =
  MatchdayCapacity | { matchday: null; start_date: string; end_date: string };

@Component({
  selector: "app-schedule-config-dialog",
  templateUrl: "./schedule-config-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormField,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    MatTimepickerModule,
    MatTooltipModule,
    RouterLink,
    TranslocoPipe,
  ],
  providers: [
    { provide: MAT_TIMEPICKER_CONFIG, useValue: { interval: "15 minutes" } },
  ],
})
export class ScheduleConfigDialogComponent {
  /** Days before today cannot be picked as the calendar's start */
  readonly today = new Date();

  private readonly api = inject(ScheduleConfigApi);
  private readonly dialogRef =
    inject<MatDialogRef<ScheduleConfigDialogComponent, boolean>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<ScheduleConfigDialogData>(MAT_DIALOG_DATA);

  protected readonly weekdays = WEEKDAYS;
  protected readonly validWindow = validWindow;
  protected readonly fitsMatch = fitsMatch;
  protected readonly dayClocks = dayClocks;
  protected readonly overlappingWindows = overlappingWindows;
  protected readonly isClock = isClock;

  private readonly tournamentId = signal(this.data.tournamentId);
  readonly configResource = this.api.config(this.tournamentId);
  readonly capacityResource = this.api.capacity(this.tournamentId);

  private readonly fieldsQuery = signal<FieldsQuery>({
    search: "",
    status: "active",
    page: 0,
    pageSize: 100,
    sort: "name",
  });
  private readonly fieldsList = inject(FieldsApi).list(this.fieldsQuery);
  /** Active fields of the league */
  readonly fields = computed(() => this.fieldsList.rows() ?? []);

  readonly loading = computed(
    () =>
      this.configResource.isLoading() || this.fieldsList.resource.isLoading(),
  );

  /** Minutes per match, as the tournament has them (null: not defined yet) */
  readonly duration = computed(() =>
    this.configResource.hasValue()
      ? this.configResource.value().match_duration_minutes
      : this.data.matchDuration,
  );

  /** The backend's refusal of the capacity (e.g. the tournament has no match duration) */
  readonly capacityError = computed(() => {
    const error: unknown = this.previewError() ?? this.capacityResource.error();

    return error instanceof HttpErrorResponse
      ? (backendMessage(error) ?? null)
      : null;
  });

  /** Messages of the backend's refusal, without repeats */
  readonly errors = signal<string[]>([]);

  readonly model = signal<ScheduleConfigModel>({
    start_date: null,
    days: [],
    blocks: [],
  });
  readonly scheduleForm = form(this.model, (schedule) => {
    applyEach(schedule.blocks, (block) => {
      required(block.date);
      // Without hours the whole day is blocked; with a start, the end is needed
      required(block.end, {
        when: ({ valueOf }) => valueOf(block.start) !== null,
      });
      disabled(block.end, ({ valueOf }) => valueOf(block.start) === null);
      validate(block.end, ({ value, valueOf }) => {
        const clocks = dayClocks({ start: valueOf(block.start), end: value() });

        return clocks.start && clocks.end && !validWindow(clocks)
          ? {
              kind: "windowError",
              message: this.transloco.translate("matches.config.windowError"),
            }
          : undefined;
      });
    });

    applyEach(schedule.days, (day) => {
      required(day.start);
      required(day.end);
      // The end waits for the start
      disabled(day.end, ({ valueOf }) => valueOf(day.start) === null);
      // ...and leaves room for at least one whole match
      validate(day.end, ({ value, valueOf }) =>
        fitsMatch(
          dayClocks({ start: valueOf(day.start), end: value() }),
          this.duration(),
        )
          ? undefined
          : {
              kind: "duration",
              message: this.transloco.translate(
                "matches.config.durationError",
                { minutes: this.duration() },
              ),
            },
      );
      // An empty list does not count as empty for `required`: it is checked here
      required(day.field_ids);
      validate(day.field_ids, ({ value }) =>
        value().length ? undefined : { kind: "required" },
      );

      applyEach(day.fields, (field) => {
        applyEach(field.windows, (window) => {
          required(window.start);
          required(window.end);
          disabled(window.end, ({ valueOf }) => valueOf(window.start) === null);
          validate(window.end, ({ value, valueOf }) => {
            const clocks = dayClocks({
              start: valueOf(window.start),
              end: value(),
            });
            const key = !validWindow(clocks)
              ? "windowError"
              : fitsMatch(clocks, this.duration())
                ? null
                : "durationError";

            // Incomplete windows are the `required` rule's business
            return key && clocks.start && clocks.end
              ? {
                  kind: key,
                  message: this.transloco.translate(`matches.config.${key}`, {
                    minutes: this.duration(),
                  }),
                }
              : undefined;
          });
        });
      });
    });
  });

  // The form is filled once, when the saved configuration arrives
  private filled = false;
  private readonly fill = effect(() => {
    if (!this.configResource.hasValue() || this.filled) {
      return;
    }

    const config = this.configResource.value();

    untracked(() => {
      this.filled = true;
      const model = toModel(config, parseDate);

      this.model.set({
        ...model,
        start_date:
          model.start_date ?? parseDate(this.data.tournamentStartDate),
      });
      this.snapshotDays();
    });
  });

  /** Weekdays still free to add */
  readonly freeWeekdays = computed(() =>
    WEEKDAYS.filter(
      (weekday) => !this.model().days.some((day) => day.weekday === weekday),
    ),
  );

  /** Everything that must be right before saving */
  readonly valid = computed(() => {
    const { start_date, days, blocks } = this.model();

    return (
      (start_date !== null || days.length === 0) &&
      days.every(
        (day) =>
          validWindow(dayClocks(day)) &&
          fitsMatch(dayClocks(day), this.duration()) &&
          day.fields.length > 0 &&
          day.fields.every((field) => {
            const windows = field.windows.map(dayClocks);

            return (
              windows.every(
                (window) =>
                  validWindow(window) && fitsMatch(window, this.duration()),
              ) && !overlappingWindows(windows).some(Boolean)
            );
          }),
      ) &&
      blocks.every(
        (block) =>
          block.date !== null &&
          ((block.start === null && block.end === null) ||
            validWindow(dayClocks(block))),
      )
    );
  });

  readonly canSave = computed(
    () => this.valid() && !!this.duration() && !this.loading(),
  );

  /** Capacity of the form's values, once "Calcular" was used; until then, the saved one */
  private readonly preview = signal<Capacity | undefined>(undefined);
  private readonly previewError = signal<unknown>(null);
  readonly calculating = signal(false);

  readonly capacity = computed(
    () =>
      this.preview() ??
      (this.capacityResource.hasValue()
        ? this.capacityResource.value()
        : undefined),
  );

  /** The capacity could not be read (saved or calculated) */
  readonly capacityFailed = computed(
    () => this.previewError() !== null || !!this.capacityResource.error(),
  );

  /** Matchdays plus, in between, the weeks that have no matchday (all play days blocked) */
  protected readonly rows = computed<CapacityRow[]>(() => {
    const matchdays = this.capacity()?.matchdays ?? [];
    const first = matchdays.find((day) => day.start_date);
    const last = matchdays.filter((day) => day.start_date).at(-1);

    if (!first?.start_date || !last?.start_date) {
      return matchdays;
    }

    const rows: CapacityRow[] = [];
    const end = parseDate(last.start_date);

    for (const week = parseDate(first.start_date); week <= end;) {
      const start = formatDate(week);
      const found = matchdays.find((day) => day.start_date === start);

      if (found) {
        rows.push(found);
      } else {
        const sunday = new Date(week);
        sunday.setDate(sunday.getDate() + 6);
        rows.push({
          matchday: null,
          start_date: start,
          end_date: formatDate(sunday),
        });
      }
      week.setDate(week.getDate() + 7);
    }

    return rows;
  });

  protected readonly columns = [
    "matchday",
    "week",
    "matches",
    "slots",
    "deficit",
  ];

  /** One line per amount of missing slots: "Faltan 2 espacios en las jornadas 3 y 5." */
  readonly deficitLines = computed(() => {
    const byDeficit = new Map<number, number[]>();

    for (const day of this.capacity()?.matchdays ?? []) {
      if (day.deficit > 0) {
        byDeficit.set(day.deficit, [
          ...(byDeficit.get(day.deficit) ?? []),
          day.matchday,
        ]);
      }
    }

    return [...byDeficit.entries()]
      .sort(([a], [b]) => a - b)
      .map(([deficit, matchdays]) =>
        this.transloco.translate(
          deficit === 1
            ? "matches.config.capacity.missingOne"
            : "matches.config.capacity.missingMany",
          { count: deficit, where: this.matchdaysText(matchdays) },
        ),
      );
  });

  /** "la jornada 1", "las jornadas 1 y 2", "las jornadas 1, 2 y 3" */
  private matchdaysText(matchdays: number[]): string {
    const list =
      matchdays.length === 1
        ? `${matchdays[0]}`
        : `${matchdays.slice(0, -1).join(", ")} ${this.transloco.translate("matches.config.capacity.and")} ${matchdays.at(-1)}`;

    return this.transloco.translate(
      matchdays.length === 1
        ? "matches.config.capacity.matchdayOne"
        : "matches.config.capacity.matchdayMany",
      { list },
    );
  }

  /** "7:00 a.m. – 1:00 p.m. · 3:00 p.m. – 5:00 p.m. · +1 más": the first two windows, then how many are left */
  rangeLabel(field: PlayDay["fields"][number]): string {
    const at = (date: Date) =>
      date.toLocaleTimeString("es-MX", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    const ranges = field.windows
      .filter(
        (window): window is { start: Date; end: Date } =>
          window.start !== null && window.end !== null,
      )
      .map((window) => `${at(window.start)} – ${at(window.end)}`);
    const shown = ranges.slice(0, MAX_RANGES_SHOWN);

    if (ranges.length > MAX_RANGES_SHOWN) {
      shown.push(
        this.transloco.translate("matches.config.moreWindows", {
          count: ranges.length - MAX_RANGES_SHOWN,
        }),
      );
    }

    return shown.join(" · ");
  }

  /** "1 franja configurada", "2 franjas configuradas" */
  windowsCountLabel(count: number): string {
    return this.transloco.translate(
      count === 1
        ? "matches.config.windowsCountOne"
        : "matches.config.windowsCountMany",
      { count },
    );
  }

  /** Some window of the field is incomplete, too short or overlaps another: shown on its header while folded */
  fieldHasIssues(field: PlayDay["fields"][number]): boolean {
    const windows = field.windows.map(dayClocks);

    return (
      windows.some(
        (window) => !validWindow(window) || !fitsMatch(window, this.duration()),
      ) || overlappingWindows(windows).some(Boolean)
    );
  }

  /** First message of a field's errors (the duration one says its own), else "required" */
  errorText(errors: ReadonlyArray<{ message?: string }>): string {
    return (
      errors.find((error) => error.message)?.message ??
      this.transloco.translate("validation.required")
    );
  }

  /** "Eliminar día lunes" */
  removeDayLabel(weekday: number): string {
    return this.transloco.translate("matches.config.removeDay", {
      day: this.transloco
        .translate(`matches.config.weekdays.${weekday}`)
        .toLowerCase(),
    });
  }

  /** "Lunes" for a Y-m-d date */
  weekdayName(date: string): string {
    const iso = ((parseDate(date).getDay() + 6) % 7) + 1;

    return this.transloco.translate(`matches.config.weekdays.${iso}`);
  }

  /** The configured play days that fall in a matchday's week, in order */
  playDates(start: string, end: string): Date[] {
    const weekdays = this.model().days.map((day) => day.weekday);
    const last = parseDate(end);
    const dates: Date[] = [];

    for (const date = parseDate(start); date <= last;) {
      if (weekdays.includes(((date.getDay() + 6) % 7) + 1)) {
        dates.push(new Date(date));
      }
      date.setDate(date.getDate() + 1);
    }

    return dates;
  }

  /** "Liguilla Oro · Semifinal (ida)" */
  playoffRoundName(round: PlayoffRoundCapacity): string {
    const leg =
      round.leg === null
        ? ""
        : ` (${this.transloco
            .translate(
              round.leg === 1
                ? "matches.bracket.first"
                : "matches.bracket.second",
            )
            .toLowerCase()})`;

    return `${round.liguilla ? `${round.liguilla} · ` : ""}${round.round_name}${leg}`;
  }

  readonly parseDate = parseDate;

  /** Name of a field: from the league's active ones, else from the saved config (it may be inactive now) */
  fieldName(id: number): string {
    const saved = this.configResource.hasValue()
      ? this.configResource.value()
      : undefined;
    const fromConfig = [
      ...(saved?.windows ?? []).map((window) => window.field),
      ...(saved?.blocks ?? []).map((block) => block.field),
    ].find((field) => field?.id === id);

    return (
      this.fields().find((field) => field.id === id)?.name ??
      fromConfig?.name ??
      `#${id}`
    );
  }

  private readonly choices = new Map<string, TimeChoices>();

  /**
   * Times one match length apart from `first`, while `fits` says the next one
   * is still inside the range (8:00 with 60 min: 8:00, 9:00, 10:00...). Null
   * while there is no valid start or duration (the picker's own list).
   */
  private grid(
    key: string,
    first: Date | null,
    fits: (value: Date, minutes: number) => boolean,
  ): TimeChoices {
    const minutes = this.duration();
    const cacheKey = `${minutes}/${key}`;

    if (!this.choices.has(cacheKey)) {
      const options: Array<{ label: string; value: Date }> = [];

      if (first && minutes) {
        for (
          let at =
            first.getTime() + (key.startsWith("end") ? minutes * 60_000 : 0);
          ;
          at += minutes * 60_000
        ) {
          const value = new Date(at);

          if (value.getDate() !== first.getDate() || !fits(value, minutes)) {
            break;
          }

          options.push({
            label: value.toLocaleTimeString("es-MX", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }),
            value,
          });
        }
      }

      this.choices.set(cacheKey, options.length ? options : null);
    }

    return this.choices.get(cacheKey) ?? null;
  }

  /** End times after `start`, one match length apart, up to `limit` (the end of the day) */
  endOptions(start: string, limit?: string): TimeChoices {
    const end = limit ? clockToDate(limit) : null;

    return this.grid(
      `end/${start}/${limit ?? ""}`,
      clockToDate(start),
      (value) => (end ? value <= end : true),
    );
  }

  /** Start times of a field's windows: from the day's start, a match length apart, leaving room for a match before the day ends */
  startOptions(dayStart: string, dayEnd: string): TimeChoices {
    const end = clockToDate(dayEnd);

    return this.grid(
      `start/${dayStart}/${dayEnd}`,
      clockToDate(dayStart),
      (value, minutes) =>
        end ? value.getTime() + minutes * 60_000 <= end.getTime() : true,
    );
  }

  /** `HH:mm` of what the timepicker emits ("" while the typed text is not a time) */
  clockOf(value: Date | null): string {
    return value ? dateToClock(value) : "";
  }

  private updateDay(index: number, change: (day: PlayDay) => PlayDay): void {
    this.model.update((model) => ({
      ...model,
      days: model.days.map((day, i) => (i === index ? change(day) : day)),
    }));
  }

  /** Hours each day had when it was last handled: the form already holds the new ones by then */
  private readonly daySeen = new Map<number, TimeWindow>();

  private snapshotDays(): void {
    this.daySeen.clear();

    for (const day of this.model().days) {
      this.daySeen.set(day.weekday, dayClocks(day));
    }

    this.snapshotWindows();
  }

  /** Windows each field had when they were last handled, by day and field */
  private readonly windowsSeen = new Map<string, TimeWindow[]>();

  private snapshotWindows(): void {
    this.windowsSeen.clear();

    for (const day of this.model().days) {
      for (const field of day.fields) {
        this.windowsSeen.set(
          `${day.weekday}:${field.field_id}`,
          field.windows.map(dayClocks),
        );
      }
    }
  }

  /**
   * A field's windows changed in the form: a start that no longer lines up
   * moves its end, and the field counts as edited by hand.
   */
  private readonly syncWindows = effect(() => {
    const days = this.model().days;

    untracked(() =>
      days.forEach((day, d) =>
        day.fields.forEach((_, f) => this.onWindows(d, f)),
      ),
    );
  });

  private onWindows(dayIndex: number, fieldIndex: number): void {
    const day = this.model().days[dayIndex];
    const field = day?.fields[fieldIndex];

    if (!field) {
      return;
    }

    const key = `${day.weekday}:${field.field_id}`;
    const now = field.windows.map(dayClocks);
    const before = this.windowsSeen.get(key);

    // Also called when the form itself rewrites a value, or windows come and go: nothing was edited then
    if (
      !before ||
      before.length !== now.length ||
      now.every(
        (window, i) =>
          window.start === before[i].start && window.end === before[i].end,
      )
    ) {
      this.windowsSeen.set(key, now);

      return;
    }

    const windows = field.windows.map((window, i) => {
      if (now[i].start === before[i].start) {
        return window;
      }

      const end = alignEnd(
        now[i].start,
        now[i].end,
        this.duration() ?? 0,
        before[i].start,
      );

      return end === now[i].end ? window : { ...window, end: clockToDate(end) };
    });

    this.windowsSeen.set(key, windows.map(dayClocks));
    this.updateDay(dayIndex, (current) => ({
      ...current,
      fields: current.fields.map((item, i) =>
        i === fieldIndex ? { ...item, windows, edited: true } : item,
      ),
    }));
  }

  addDay(weekday: number): void {
    const day: PlayDay = {
      weekday,
      ...DEFAULT_DAY,
      field_ids: [],
      fields: [] as PlayDay["fields"],
    };

    // With a single field there is nothing to choose: it comes selected
    const [only, ...others] = this.fields();

    if (only && !others.length) {
      day.field_ids = [only.id];
      day.fields = [
        {
          field_id: only.id,
          windows: defaultWindows(dayClocks(day)),
          edited: false,
        },
      ];
    }

    this.model.update((model) => ({
      ...model,
      days: [...model.days, day].sort((a, b) => a.weekday - b.weekday),
    }));
    this.daySeen.set(weekday, dayClocks(day));
    this.snapshotWindows();
  }

  removeDay(index: number): void {
    this.daySeen.delete(this.model().days[index]?.weekday);
    this.model.update((model) => ({
      ...model,
      days: model.days.filter((_, i) => i !== index),
    }));
  }

  /**
   * The days' hours changed in the form (picked, typed or written by code):
   * a start that no longer lines up moves the end, and the fields not edited
   * by hand take the new default hours.
   */
  private readonly syncDayTimes = effect(() => {
    const days = this.model().days;

    untracked(() => days.forEach((_, index) => this.onDayTimes(index)));
  });

  private onDayTimes(index: number): void {
    const day = this.model().days[index];

    if (!day) {
      return;
    }

    const now = dayClocks(day);
    const before = this.daySeen.get(day.weekday);

    // Also called when the form itself rewrites a value: nothing changed then
    if (!before) {
      this.daySeen.set(day.weekday, now);

      return;
    }

    if (before.start === now.start && before.end === now.end) {
      return;
    }

    const end =
      before.start === now.start
        ? now.end
        : alignEnd(now.start, now.end, this.duration() ?? 0, before.start);
    const next = { start: now.start, end };

    this.daySeen.set(day.weekday, next);
    this.updateDay(index, (current) => ({
      ...current,
      end: end === now.end ? current.end : clockToDate(end),
      fields: current.fields.map((field) => {
        if (!field.edited) {
          return { ...field, windows: defaultWindows(next) };
        }

        // A window edited by hand stays, but inside the day's new range
        const windows = clampWindows(field.windows.map(dayClocks), next);

        return windows.length
          ? { ...field, windows: windows.map(toRange) }
          : { ...field, windows: defaultWindows(next), edited: false };
      }),
    }));
    this.snapshotWindows();
  }

  /** Fields used on a day: new ones start with a copy of the day's hours */
  setDayFields(index: number, ids: number[]): void {
    this.updateDay(index, (day) => ({
      ...day,
      field_ids: ids,
      fields: ids.map(
        (id) =>
          day.fields.find((field) => field.field_id === id) ?? {
            field_id: id,
            windows: defaultWindows(dayClocks(day)),
            edited: false,
          },
      ),
    }));
    this.snapshotWindows();
  }

  private updateField(
    dayIndex: number,
    fieldIndex: number,
    change: (
      windows: PlayDay["fields"][number]["windows"],
    ) => PlayDay["fields"][number]["windows"],
  ): void {
    this.updateDay(dayIndex, (day) => ({
      ...day,
      fields: day.fields.map((field, i) =>
        i === fieldIndex
          ? { ...field, windows: change(field.windows), edited: true }
          : field,
      ),
    }));
    this.snapshotWindows();
  }

  removeWindow(
    dayIndex: number,
    fieldIndex: number,
    windowIndex: number,
  ): void {
    this.updateField(dayIndex, fieldIndex, (windows) =>
      windows.filter((_, i) => i !== windowIndex),
    );
  }

  /** "Dividir horario": another window after the last one */
  addWindow(dayIndex: number, fieldIndex: number): void {
    this.updateField(dayIndex, fieldIndex, (windows) => [
      ...windows,
      { start: null, end: null },
    ]);
  }

  resetField(dayIndex: number, fieldIndex: number): void {
    this.updateDay(dayIndex, (day) => ({
      ...day,
      fields: day.fields.map((field, i) =>
        i === fieldIndex
          ? {
              ...field,
              windows: defaultWindows(dayClocks(day)),
              edited: false,
            }
          : field,
      ),
    }));
    this.snapshotWindows();
  }

  /** The block panel left open: the one just added, to fill it in */
  readonly openBlock = signal<number | null>(null);

  addBlock(): void {
    const block: BlockedDate = {
      date: null,
      field_id: "",
      start: null,
      end: null,
      reason: "",
    };

    this.openBlock.set(this.model().blocks.length);
    this.model.update((model) => ({
      ...model,
      blocks: [...model.blocks, block],
    }));
  }

  removeBlock(index: number): void {
    this.openBlock.set(null);
    this.model.update((model) => ({
      ...model,
      blocks: model.blocks.filter((_, i) => i !== index),
    }));
  }

  /** "Domingo, 10 de enero de 2027" */
  blockTitle(block: BlockedDate): string {
    if (!block.date) {
      return this.transloco.translate("matches.config.blockNoDate");
    }

    const text = block.date.toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /** "Cancha 1 · 9:00 a.m. – 10:00 a.m." or "Todas las canchas · Todo el día" */
  blockSubtitle(block: BlockedDate): string {
    const at = (date: Date) =>
      date.toLocaleTimeString("es-MX", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    const field =
      block.field_id === ""
        ? this.transloco.translate("matches.config.blockAllFields")
        : this.fieldName(block.field_id);
    const hours =
      block.start && block.end
        ? `${at(block.start)} – ${at(block.end)}`
        : block.start
          ? at(block.start)
          : this.transloco.translate("matches.config.blockAllDay");

    return `${field} · ${hours}`;
  }

  /** The block has no date or its hours are incomplete or backwards */
  blockHasIssues(block: BlockedDate): boolean {
    const clocks = dayClocks(block);

    return (
      block.date === null ||
      (block.start !== null || block.end !== null
        ? !validWindow(clocks)
        : false)
    );
  }

  /** Closes without saving (the link to the tournament's management leaves the page) */
  close(): void {
    this.dialogRef.close(false);
  }

  /** Capacity with what the form has now, saved or not */
  calculate(): void {
    if (!this.valid() || this.calculating()) {
      return;
    }

    this.calculating.set(true);
    this.previewError.set(null);
    this.api
      .previewCapacity(this.data.tournamentId, toBody(this.model(), formatDate))
      .subscribe({
        next: (capacity) => {
          this.preview.set(capacity);
          this.calculating.set(false);
        },
        error: (error: unknown) => {
          this.previewError.set(error);
          this.calculating.set(false);
        },
      });
  }

  save(): Promise<boolean> {
    this.errors.set([]);

    if (!this.canSave()) {
      return Promise.resolve(false);
    }

    return this.formSubmit.submit(this.scheduleForm, {
      errors: "form",
      onFormError: (message) => {
        if (!this.errors().length) {
          this.errors.set(uniqueMessages([message]));
        }
      },
      send: () =>
        this.api
          .save(this.data.tournamentId, toBody(this.model(), formatDate))
          .pipe(
            catchError((error: unknown) => {
              const messages = Object.values(fieldErrors(error) ?? {}).flat();

              if (messages.length) {
                this.errors.set(uniqueMessages(messages));
              }

              return throwError(() => error);
            }),
          ),
      onSuccess: () => this.dialogRef.close(true),
    });
  }
}
