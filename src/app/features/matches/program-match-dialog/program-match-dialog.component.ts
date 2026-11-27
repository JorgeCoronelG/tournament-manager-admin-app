import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MAT_DATE_FORMATS, MatDateFormats } from "@angular/material/core";
import { MatDatepickerModule } from "@angular/material/datepicker";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import {
  debounce,
  form,
  FormField,
  required,
  validate,
} from "@angular/forms/signals";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatTimepickerModule } from "@angular/material/timepicker";
import { MatTooltipModule } from "@angular/material/tooltip";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { Observable } from "rxjs";
import { fieldErrors } from "../../../core/http/api-errors";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { FieldsQuery } from "../../fields/field.model";
import { FieldsApi } from "../../fields/fields.api";
import { formatDate, parseDate } from "../../tournaments/tournament.model";
import { Match } from "../match.model";
import { injectIsMobile } from "../../../shared/responsive/is-mobile";
import { ScrollFadeComponent } from "../../../shared/scroll-fade/scroll-fade.component";
import { hasInvalidTime } from "../../../shared/time-error";
import { MatchScheduleApi } from "../match-schedule.api";
import { shortClock, sortSwapCandidates } from "../schedule.model";
import { busyReasonLabel, MatchWarning } from "../match-schedule.model";
import {
  clockToDate,
  dateToClock,
  uniqueMessages,
} from "../schedule-config.model";
import { slotLabel } from "../schedule.model";

export interface ProgramMatchDialogData {
  tournamentId: number;
  match: Match;
  /** The tournament's other matches that are not played: the ones it can swap with */
  candidates: Match[];
  /** The tournament has several groups: the match says which one it belongs to */
  hasSeveralGroups?: boolean;
}

/** The picker of this dialog works in 12 h (a. m. / p. m.) */
const FORMATS_12H: MatDateFormats = {
  parse: { dateInput: null, timeInput: null },
  display: {
    dateInput: { day: "2-digit", month: "2-digit", year: "numeric" },
    timeInput: { hour: "2-digit", minute: "2-digit", hour12: true },
    timeOptionLabel: { hour: "2-digit", minute: "2-digit", hour12: true },
    monthYearLabel: { year: "numeric", month: "short" },
    dateA11yLabel: { year: "numeric", month: "long", day: "numeric" },
    monthYearA11yLabel: { year: "numeric", month: "long" },
  },
};

/**
 * Sets the day, hour, field and referee of a match by hand, or swaps its
 * schedule with another match. Closes with `true` once something changed.
 */
@Component({
  selector: "app-program-match-dialog",
  templateUrl: "./program-match-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MAT_DATE_FORMATS, useValue: FORMATS_12H }],
  imports: [
    MatButtonModule,
    FormField,
    MatCheckboxModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    ScrollFadeComponent,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTimepickerModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
})
export class ProgramMatchDialogComponent {
  private readonly api = inject(MatchScheduleApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialogRef =
    inject<MatDialogRef<ProgramMatchDialogComponent, boolean>>(MatDialogRef);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  protected readonly isMobile = injectIsMobile();

  readonly data = inject<ProgramMatchDialogData>(MAT_DIALOG_DATA);

  private readonly tbd = this.transloco.translate("matches.bracket.tbd");

  /** On a phone the keyboard covers the lower part: the search field stays in view once it opens */
  onSearchFocus(input: HTMLElement): void {
    if (this.isMobile()) {
      setTimeout(() => input.scrollIntoView({ block: "nearest" }), 300);
    }
  }

  readonly home = this.data.match.home?.team_name ?? this.tbd;
  readonly away = this.data.match.away?.team_name ?? this.tbd;

  /** Text that is not a time reads as empty to the form: it gets its own message */
  readonly hasInvalidTime = hasInvalidTime;

  readonly view = signal<"edit" | "swap">("edit");

  // What the user picked
  private readonly model = signal<{
    date: Date | null;
    time: Date | null;
    field: number | null;
    referee: number | null;
  }>({
    date: this.data.match.match_datetime
      ? parseDate(this.data.match.match_datetime.slice(0, 10))
      : null,
    time: this.data.match.match_datetime
      ? clockToDate(this.data.match.match_datetime.slice(11, 16))
      : null,
    field: this.data.match.field?.id ?? null,
    referee: this.data.match.referee?.id ?? null,
  });
  readonly programForm = form(this.model, (program) => {
    required(program.date);
    required(program.time);
    // What is typed in the hour reaches the model (and the referees request) when the field loses focus
    debounce(program.time, "blur");
    // Half-typed text ("8") reads as an invalid date: it is only reported once the field loses focus
    validate(program.time, ({ value }) =>
      value() && Number.isNaN(value()?.getTime())
        ? { kind: "invalid" }
        : undefined,
    );
    required(program.field);
  });

  private readonly date = computed(() => this.model().date);
  private readonly time = computed(() => this.model().time);
  private readonly fieldId = computed(() => this.model().field);
  private readonly refereeId = computed(() => this.model().referee);
  /** A match that already has a schedule keeps whether it was fixed; a new one starts fixed */
  private readonly initialLocked = this.data.match.match_datetime
    ? !!this.data.match.schedule_locked
    : true;
  readonly locked = signal(this.initialLocked);

  /** Past days cannot be picked */
  readonly today = new Date();

  private readonly fieldsQuery = signal<FieldsQuery>({
    search: "",
    status: "active",
    page: 0,
    pageSize: 100,
    sort: "name",
  });
  private readonly fieldsList = inject(FieldsApi).list(this.fieldsQuery);
  readonly fields = computed(() => this.fieldsList.rows() ?? []);

  private readonly day = computed(() => {
    const date = this.date();

    return date ? formatDate(date) : undefined;
  });

  /** `Y-m-dTHH:mm`, once both the day and the hour are there */
  private readonly moment = computed(() => {
    const day = this.day();
    const time = this.time();

    // While the hour is half-typed it is not a date yet: nothing is asked of the backend
    return day && time && !Number.isNaN(time.getTime())
      ? `${day}T${dateToClock(time)}`
      : undefined;
  });

  private readonly slotsResource = this.api.availableSlots(
    this.data.match.id,
    this.day,
  );
  readonly slots = computed(() =>
    this.slotsResource.hasValue() ? this.slotsResource.value().slots : [],
  );

  /** All the free slots are listed, not just the first ones */
  readonly slotsExpanded = signal(false);
  /** Free slots listed before "Ver los N espacios restantes" */
  private static readonly SLOTS_SHOWN = 6;
  readonly visibleSlots = computed(() =>
    this.slotsExpanded()
      ? this.slots()
      : this.slots().slice(0, ProgramMatchDialogComponent.SLOTS_SHOWN),
  );
  /** Free slots past the first ones */
  readonly hiddenSlots = computed(() =>
    Math.max(0, this.slots().length - ProgramMatchDialogComponent.SLOTS_SHOWN),
  );

  private readonly refereesResource = this.api.availableReferees(
    this.data.match.id,
    this.moment,
  );
  readonly referees = computed(() =>
    this.refereesResource.hasValue()
      ? this.refereesResource.value().referees
      : [],
  );

  /** Something differs from what the match had: only then there is anything to save */
  readonly changed = computed(
    () =>
      this.moment() !== this.data.match.match_datetime?.slice(0, 16) ||
      this.fieldId() !== (this.data.match.field?.id ?? null) ||
      this.refereeId() !== (this.data.match.referee?.id ?? null) ||
      this.locked() !== this.initialLocked,
  );

  readonly working = signal(false);
  /** The API's refusals, without repeats */
  readonly errors = signal<string[]>([]);
  /** Warnings of what was saved: the dialog stays open to show them */
  readonly warnings = signal<string[]>([]);
  readonly saved = signal(false);

  readonly hasSchedule = !!this.data.match.match_datetime;

  // Swap
  readonly search = signal("");
  readonly target = signal<Match | null>(null);
  readonly options = computed(() => {
    const term = this.search().trim().toLowerCase();

    return sortSwapCandidates(
      this.data.candidates.filter(
        (match) =>
          match.id !== this.data.match.id &&
          (!term ||
            [match.home?.team_name, match.away?.team_name].some((name) =>
              name?.toLowerCase().includes(term),
            )),
      ),
    );
  });

  /**
   * An hour picked from the list reaches the model at once: the field keeps the
   * focus and its blur-debounced value would still read as empty ("required")
   */
  pickTime(time: Date): void {
    this.model.update((value) => ({ ...value, time }));
  }

  /** A suggestion fills the hour and the field */
  pickSlot(slot: { start_time: string; field_id: number }): void {
    this.model.update((value) => ({
      ...value,
      time: clockToDate(slot.start_time),
      field: slot.field_id,
    }));
  }

  isPicked(slot: { start_time: string; field_id: number }): boolean {
    const time = this.time();

    return (
      !!time &&
      dateToClock(time) === slot.start_time &&
      this.fieldId() === slot.field_id
    );
  }

  /** "Sáb 07/11 · 8:00 a.m. · Cancha 1" of a match, or its absence */
  /** "7:00 a.m." for "07:00" */
  readonly clockLabel = shortClock;
  readonly busyReasonLabel = busyReasonLabel;

  slotOf(match: Match): string {
    return match.match_datetime
      ? slotLabel(match.match_datetime, match.field?.name, (weekday) =>
          this.transloco.translate(`matches.config.weekdays.${weekday}`),
        )
      : this.transloco.translate("matches.program.noSchedule");
  }

  nameOf(match: Match): string {
    return `${match.home?.team_name ?? this.tbd} vs ${match.away?.team_name ?? this.tbd}`;
  }

  /** "Jornada 3", or the playoff round where there is no matchday */
  roundOf(match: Match): string {
    return (
      match.round_label ??
      this.transloco.translate("matches.matchday", { number: match.matchday })
    );
  }

  save(): void {
    const moment = this.moment();

    this.run(
      this.api.update(this.data.match.id, {
        match_datetime: moment ? `${moment}:00` : null,
        field_id: moment ? this.fieldId() : null,
        referee_user_id: this.refereeId(),
        schedule_locked: this.locked(),
      }),
      (result) => this.finish("matches.program.saved", result.warnings),
    );
  }

  /** Leaves date, hour, field, referee and lock empty */
  clear(): void {
    this.confirmDialog
      .confirm({
        key: "matches.program.clear",
        params: {
          match: this.nameOf(this.data.match),
          lock: this.data.match.schedule_locked
            ? ` ${this.transloco.translate("matches.program.clear.lock")}`
            : "",
        },
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.run(
            this.api.update(this.data.match.id, {
              match_datetime: null,
              field_id: null,
              referee_user_id: null,
              schedule_locked: false,
            }),
            () => this.finish("matches.program.cleared", []),
          );
        }
      });
  }

  openSwap(): void {
    this.errors.set([]);
    this.view.set("swap");
  }

  backToEdit(): void {
    this.errors.set([]);
    this.target.set(null);
    this.view.set("edit");
  }

  swap(): void {
    const target = this.target();

    if (!target) {
      return;
    }

    this.run(this.api.swap(this.data.match.id, target.id), (result) =>
      this.finish("matches.program.swapped", result.warnings),
    );
  }

  close(): void {
    this.dialogRef.close(this.saved());
  }

  private finish(key: string, warnings: MatchWarning[]): void {
    this.saved.set(true);
    const messages = uniqueMessages(warnings.map((w) => w.message));

    // On a phone the dialog closes: what was saved and its warnings go in one notice
    if (messages.length && this.isMobile()) {
      this.snackbar.warning(
        `${this.transloco.translate(key)}. ${messages.join(" ")}`,
      );
      this.close();

      return;
    }

    this.snackbar.notifySuccess(key);

    if (messages.length) {
      this.warnings.set(messages);
      // Only the button closes it: the warnings must be seen first
      this.dialogRef.disableClose = true;
    } else {
      this.close();
    }
  }

  private run<T>(request: Observable<T>, onSuccess: (result: T) => void): void {
    if (this.working()) {
      return;
    }

    this.working.set(true);
    this.errors.set([]);
    request.subscribe({
      next: (result) => {
        this.working.set(false);
        onSuccess(result);
      },
      error: (error: unknown) => {
        this.working.set(false);

        const messages = Object.values(fieldErrors(error) ?? {}).flat();

        this.errors.set(
          uniqueMessages(
            messages.length ? messages : [this.snackbar.failureText(error)],
          ),
        );
      },
    });
  }
}
