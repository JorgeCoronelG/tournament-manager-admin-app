import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DATE_FORMATS, MatDateFormats } from "@angular/material/core";
import { MatDatepickerModule } from "@angular/material/datepicker";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatTimepickerModule } from "@angular/material/timepicker";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { Observable } from "rxjs";
import { fieldErrors } from "../../../core/http/api-errors";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { FieldsQuery } from "../../fields/field.model";
import { FieldsApi } from "../../fields/fields.api";
import { formatDate, parseDate } from "../../tournaments/tournament.model";
import { Match } from "../match.model";
import { MatchScheduleApi } from "../match-schedule.api";
import { MatchWarning } from "../match-schedule.model";
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
}

/** The picker of this dialog works in 24 h */
const FORMATS_24H: MatDateFormats = {
  parse: { dateInput: null, timeInput: null },
  display: {
    dateInput: { day: "2-digit", month: "2-digit", year: "numeric" },
    timeInput: { hour: "2-digit", minute: "2-digit", hour12: false },
    timeOptionLabel: { hour: "2-digit", minute: "2-digit", hour12: false },
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
  providers: [{ provide: MAT_DATE_FORMATS, useValue: FORMATS_24H }],
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTimepickerModule,
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

  readonly data = inject<ProgramMatchDialogData>(MAT_DIALOG_DATA);

  private readonly tbd = this.transloco.translate("matches.bracket.tbd");

  readonly home = this.data.match.home?.team_name ?? this.tbd;
  readonly away = this.data.match.away?.team_name ?? this.tbd;

  readonly view = signal<"edit" | "swap">("edit");

  // What the user picked
  readonly date = signal<Date | null>(
    this.data.match.match_datetime
      ? parseDate(this.data.match.match_datetime.slice(0, 10))
      : null,
  );
  readonly time = signal<Date | null>(
    this.data.match.match_datetime
      ? clockToDate(this.data.match.match_datetime.slice(11, 16))
      : null,
  );
  readonly fieldId = signal<number | null>(this.data.match.field?.id ?? null);
  readonly refereeId = signal<number | null>(
    this.data.match.referee?.id ?? null,
  );
  readonly locked = signal(true);

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

    return day && time ? `${day}T${dateToClock(time)}` : undefined;
  });

  private readonly slotsResource = this.api.availableSlots(
    this.data.match.id,
    this.day,
  );
  readonly slots = computed(() =>
    this.slotsResource.hasValue() ? this.slotsResource.value().slots : [],
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

    return this.data.candidates.filter(
      (match) =>
        match.id !== this.data.match.id &&
        (!term ||
          [match.home?.team_name, match.away?.team_name].some((name) =>
            name?.toLowerCase().includes(term),
          )),
    );
  });

  /** A suggestion fills the hour and the field */
  pickSlot(slot: { start_time: string; field_id: number }): void {
    this.time.set(clockToDate(slot.start_time));
    this.fieldId.set(slot.field_id);
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

  /** Leaves date, hour and field empty and keeps the referee */
  clear(): void {
    this.confirmDialog
      .confirm({
        key: "matches.program.clear",
        params: { match: this.nameOf(this.data.match) },
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.run(
            this.api.update(this.data.match.id, {
              match_datetime: null,
              field_id: null,
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
    this.snackbar.notifySuccess(key);

    if (warnings.length) {
      this.warnings.set(uniqueMessages(warnings.map((w) => w.message)));
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
