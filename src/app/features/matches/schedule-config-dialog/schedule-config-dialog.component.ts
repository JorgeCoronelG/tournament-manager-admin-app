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
import { form, FormField } from "@angular/forms/signals";
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
  MatchdayCapacity,
  clockToDate,
  dateToClock,
  defaultWindows,
  isClock,
  PlayDay,
  ScheduleConfigModel,
  toBody,
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
const DEFAULT_DAY = { start: "", end: "" };

type Edge = "start" | "end";

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
  private readonly api = inject(ScheduleConfigApi);
  private readonly dialogRef =
    inject<MatDialogRef<ScheduleConfigDialogComponent, boolean>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<ScheduleConfigDialogData>(MAT_DIALOG_DATA);

  protected readonly weekdays = WEEKDAYS;
  protected readonly validWindow = validWindow;
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
  readonly scheduleForm = form(this.model);

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
          validWindow(day) &&
          day.fields.every(
            (field) =>
              field.windows.every(validWindow) &&
              !overlappingWindows(field.windows).some(Boolean),
          ),
      ) &&
      blocks.every(
        (block) =>
          block.date !== null &&
          ((block.start === "" && block.end === "") ||
            validWindow({ start: block.start, end: block.end })),
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

  private readonly dates = new Map<string, Date | null>();

  /**
   * The timepicker's value for a clock. The same text always gives the same
   * `Date`: a new one on every change detection pass makes the input see a new
   * value each time (NG0103).
   */
  toDate(clock: string): Date | null {
    if (!this.dates.has(clock)) {
      this.dates.set(clock, clockToDate(clock));
    }

    return this.dates.get(clock) ?? null;
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

  addDay(weekday: number): void {
    this.model.update((model) => ({
      ...model,
      days: [
        ...model.days,
        { weekday, ...DEFAULT_DAY, fields: [] as PlayDay["fields"] },
      ].sort((a, b) => a.weekday - b.weekday),
    }));
  }

  removeDay(index: number): void {
    this.model.update((model) => ({
      ...model,
      days: model.days.filter((_, i) => i !== index),
    }));
  }

  /** New default hours of a day: copied to the fields not edited by hand */
  setDayTime(index: number, edge: Edge, value: string): void {
    this.updateDay(index, (day) => {
      const next = { ...day, [edge]: value };

      // A start that no longer lines up with the end moves the end to a valid one
      if (edge === "start") {
        next.end = alignEnd(value, day.end, this.duration() ?? 0, day.start);
      }

      return {
        ...next,
        fields: next.fields.map((field) => {
          if (!field.edited) {
            return { ...field, windows: defaultWindows(next) };
          }

          // A window edited by hand stays, but inside the day's new range
          const windows = clampWindows(field.windows, next);

          return windows.length
            ? { ...field, windows }
            : { ...field, windows: defaultWindows(next), edited: false };
        }),
      };
    });
  }

  /** Fields used on a day: new ones start with a copy of the day's hours */
  setDayFields(index: number, ids: number[]): void {
    this.updateDay(index, (day) => ({
      ...day,
      fields: ids.map(
        (id) =>
          day.fields.find((field) => field.field_id === id) ?? {
            field_id: id,
            windows: defaultWindows(day),
            edited: false,
          },
      ),
    }));
  }

  fieldIds(day: PlayDay): number[] {
    return day.fields.map((field) => field.field_id);
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
  }

  setWindow(
    dayIndex: number,
    fieldIndex: number,
    windowIndex: number,
    edge: Edge,
    value: string,
  ): void {
    this.updateField(dayIndex, fieldIndex, (windows) =>
      windows.map((window, i) => {
        if (i !== windowIndex) {
          return window;
        }

        return edge === "start"
          ? {
              start: value,
              end: alignEnd(
                value,
                window.end,
                this.duration() ?? 0,
                window.start,
              ),
            }
          : { ...window, end: value };
      }),
    );
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
      { start: "", end: "" },
    ]);
  }

  resetField(dayIndex: number, fieldIndex: number): void {
    this.updateDay(dayIndex, (day) => ({
      ...day,
      fields: day.fields.map((field, i) =>
        i === fieldIndex
          ? { ...field, windows: defaultWindows(day), edited: false }
          : field,
      ),
    }));
  }

  addBlock(): void {
    const block: BlockedDate = {
      date: null,
      field_id: "",
      start: "",
      end: "",
      reason: "",
    };

    this.model.update((model) => ({
      ...model,
      blocks: [...model.blocks, block],
    }));
  }

  removeBlock(index: number): void {
    this.model.update((model) => ({
      ...model,
      blocks: model.blocks.filter((_, i) => i !== index),
    }));
  }

  setBlockTime(index: number, edge: Edge, value: string): void {
    this.model.update((model) => ({
      ...model,
      blocks: model.blocks.map((block, i) =>
        i === index ? { ...block, [edge]: value } : block,
      ),
    }));
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
