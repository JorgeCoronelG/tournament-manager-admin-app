import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import {
  MatDatepickerInputEvent,
  MatDatepickerModule,
} from "@angular/material/datepicker";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatSelectModule } from "@angular/material/select";
import { MatTooltipModule } from "@angular/material/tooltip";
import {
  applyEach,
  form,
  FormField,
  maxLength,
  required,
  validate,
  ValidationError,
} from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { formatDate, parseDate } from "../../tournaments/tournament.model";
import {
  autoRoundDates,
  datesInOrder,
  DEFAULT_ROUND_INTERVAL_DAYS,
  Group,
  isValidPlayoffTotal,
  matchTotal,
  playoffRounds,
  playoffTotal,
  PlayoffSourceBody,
  PlayoffSourceKind,
  roundLabel,
  RoundLegs,
} from "../group.model";
import { GroupsApi } from "../groups.api";

export interface PlayoffFormDialogData {
  tournamentId: number;
  /** The tournament's regular groups: the playoff takes its teams from them */
  groups: Group[];
  /** The playoff to edit; absent when creating */
  playoff?: Group;
}

interface SourceRow {
  kind: PlayoffSourceKind;
  source_group_id: number | "";
  /** The position, in a best-of-position source */
  position_start: number | null;
  position_end: number | null;
  best_count: number | null;
}

interface PlayoffFormModel {
  name: string;
  start_date: Date | null;
  round_interval_days: number | null;
  /** One row per round: played over one match or two (home and away) */
  round_legs: Array<{ legs: RoundLegs }>;
  /** One row per match, first round to the final */
  round_dates: Array<{ date: Date | null }>;
  sources: SourceRow[];
}

const NAME_MAX = 100;

const emptySource = (kind: PlayoffSourceKind = "range"): SourceRow => ({
  kind,
  source_group_id: "",
  position_start: null,
  position_end: null,
  best_count: null,
});

/**
 * Creates a playoff, or edits the one passed as data: its name, dates and the
 * slices of the regular groups that qualify. The total of teams must be a
 * power of 2 and it is shown live with the rounds it gives. Closes with the saved playoff.
 */
@Component({
  selector: "app-playoff-form-dialog",
  templateUrl: "./playoff-form-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
})
export class PlayoffFormDialogComponent {
  private readonly api = inject(GroupsApi);
  private readonly dialogRef =
    inject<MatDialogRef<PlayoffFormDialogComponent, Group>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<PlayoffFormDialogData>(MAT_DIALOG_DATA);

  private readonly model = signal<PlayoffFormModel>({
    name: this.data.playoff?.name ?? "",
    start_date: this.data.playoff?.start_date
      ? parseDate(this.data.playoff.start_date)
      : null,
    round_interval_days:
      this.data.playoff?.round_interval_days ?? DEFAULT_ROUND_INTERVAL_DAYS,
    round_legs: (
      this.data.playoff?.round_legs ??
      this.data.playoff?.rounds_detail?.map((round) => round.legs) ??
      []
    ).map((legs) => ({ legs })),
    round_dates: (this.data.playoff?.rounds_detail ?? [])
      .flatMap((round) => round.dates)
      .map((date) => ({ date: date ? parseDate(date) : null })),
    sources: this.data.playoff?.sources?.length
      ? this.data.playoff.sources.map((source): SourceRow => ({
          kind: source.kind ?? "range",
          source_group_id: source.source_group_id ?? "",
          position_start: source.position_start,
          position_end:
            source.kind === "best_of_position" ? null : source.position_end,
          best_count: source.best_count ?? null,
        }))
      : [emptySource()],
  });

  /** Failures that belong to no field (e.g. overlapping ranges), as the backend words them */
  readonly formError = signal<string | null>(null);

  private readonly errorBanner =
    viewChild<ElementRef<HTMLElement>>("errorBanner");

  /** The alert sits at the top of a long form: bring it into view of the dialog's scroll */
  private readonly revealError = effect(() => {
    this.errorBanner()?.nativeElement.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  });

  readonly playoffForm = form(this.model, (playoff) => {
    required(playoff.name);
    maxLength(playoff.name, NAME_MAX);
    validate(playoff.round_interval_days, ({ value }) => {
      const days = value();

      return days !== null && Number.isInteger(days) && days >= 1
        ? undefined
        : { kind: "days" };
    });
    applyEach(playoff.sources, (source) => {
      validate(source.source_group_id, ({ value, valueOf }) =>
        valueOf(source.kind) === "best_of_position" || value() !== ""
          ? undefined
          : { kind: "required" },
      );
      validate(source.best_count, ({ value, valueOf }) => {
        const count = value();

        return valueOf(source.kind) !== "best_of_position" ||
          (count !== null && Number.isInteger(count) && count >= 1)
          ? undefined
          : { kind: "bestCount" };
      });
      validate(source.position_start, ({ value }) => {
        const start = value();

        return start !== null && Number.isInteger(start) && start >= 1
          ? undefined
          : { kind: "position" };
      });
      validate(source.position_end, ({ value, valueOf }) => {
        const end = value();
        const start = valueOf(source.position_start);

        return valueOf(source.kind) === "best_of_position" ||
          (end !== null &&
            Number.isInteger(end) &&
            (start === null || end >= start))
          ? undefined
          : { kind: "positionEnd" };
      });
    });
    validate(playoff.round_dates, ({ value }) =>
      datesInOrder(value().map((row) => row.date))
        ? undefined
        : { kind: "roundsOrder" },
    );
    validate(playoff.sources, ({ value }) =>
      isValidPlayoffTotal(playoffTotal(value()))
        ? undefined
        : { kind: "total" },
    );
  });

  /** Some source compares the best teams of a position across the groups */
  readonly hasBestSource = computed(() =>
    this.model().sources.some((source) => source.kind === "best_of_position"),
  );

  readonly total = computed(() => playoffTotal(this.model().sources));
  readonly totalValid = computed(() => isValidPlayoffTotal(this.total()));

  /** The rounds the total gives, first round to the final */
  readonly rounds = computed(() =>
    this.totalValid()
      ? playoffRounds(this.total()).map((teams) => {
          const { key, params } = roundLabel(teams);

          return this.transloco.translate(key, params);
        })
      : [],
  );

  private readonly roundCount = computed(() =>
    this.totalValid() ? playoffRounds(this.total()).length : 0,
  );

  /** Rows (after the first) whose date the admin set by hand: the automatic calculation keeps them */
  private readonly edited = signal<ReadonlySet<number>>(this.initialEdited());

  /** Saved dates that differ from start + interval were picked by hand */
  private initialEdited(): ReadonlySet<number> {
    const playoff = this.data.playoff;
    const saved = (playoff?.rounds_detail ?? []).flatMap(
      (round) => round.dates,
    );
    const auto = autoRoundDates(
      playoff?.start_date ? parseDate(playoff.start_date) : null,
      playoff?.round_interval_days ?? null,
      saved.length,
    );

    return new Set(
      saved
        .map((date, index) => ({ date, index }))
        .filter(
          ({ date, index }) =>
            index > 0 &&
            !!date &&
            (!auto[index] || formatDate(auto[index] as Date) !== date),
        )
        .map(({ index }) => index),
    );
  }

  /** The list of dates only exists with a start date */
  readonly hasStart = computed(() => this.model().start_date !== null);

  /** Shown after the number of rounds changed and the dates were recalculated */
  readonly roundsChanged = signal(false);

  /** Matches of each round as text ("1,2,1"): changes whenever the rounds or their legs do */
  private readonly layout = computed(() =>
    this.model()
      .round_legs.map((row) => row.legs)
      .join(","),
  );

  /** The layout the dates were last calculated for; empty before the first one */
  private lastLayout = this.layout();

  /** Name of every match to date: a two-legged round has an "(ida)" and a "(vuelta)" */
  readonly matchLabels = computed(() => {
    const legs = this.model().round_legs;

    return this.rounds().flatMap((name, index) =>
      legs[index]?.legs === 2
        ? [
            this.transloco.translate("groups.playoff.legFirst", { name }),
            this.transloco.translate("groups.playoff.legSecond", { name }),
          ]
        : [name],
    );
  });

  constructor() {
    effect(() => {
      const start = this.playoffForm.start_date().value();
      const interval = this.playoffForm.round_interval_days().value();
      const count = this.roundCount();
      this.layout();

      untracked(() => this.syncRoundDates(start, interval, count));
    });
  }

  /**
   * Start date and interval fill the matches the admin did not date by hand. A
   * new number of rounds (every round goes back to one match) or of matches in
   * a round starts the dates over.
   */
  private syncRoundDates(
    start: Date | null,
    interval: number | null,
    count: number,
  ): void {
    if (count === 0) {
      return;
    }

    let legs = this.model().round_legs.map((row) => row.legs);

    if (legs.length !== count) {
      legs = Array.from({ length: count }, (): RoundLegs => 1);
      this.model.update((model) => ({
        ...model,
        round_legs: legs.map((value) => ({ legs: value })),
      }));
    }

    const layout = legs.join(",");
    const restart = layout !== this.lastLayout;

    if (restart) {
      this.roundsChanged.set(this.lastLayout !== "");
      this.edited.set(new Set());
      this.lastLayout = layout;
    }

    const auto = autoRoundDates(start, interval, matchTotal(legs));

    if (!start) {
      this.edited.set(new Set());
      this.roundsChanged.set(false);
    }

    const edited = this.edited();

    this.model.update((model) => ({
      ...model,
      round_dates: auto.map((date, index) => ({
        date:
          !restart && index > 0 && edited.has(index)
            ? (model.round_dates[index]?.date ?? null)
            : date,
      })),
    }));
  }

  /** A date picked by hand: the first round is the start date, the others stay as picked */
  setRoundDate(index: number, date: Date | null): void {
    this.roundsChanged.set(false);

    if (index === 0) {
      this.model.update((model) => ({ ...model, start_date: date }));

      return;
    }

    this.edited.update((edited) => {
      const next = new Set(edited);

      if (date) {
        next.add(index);
      } else {
        next.delete(index);
      }

      return next;
    });
    this.model.update((model) => ({
      ...model,
      round_dates: model.round_dates.map((row, i) =>
        i === index ? { date } : row,
      ),
    }));

    if (!date) {
      this.syncRoundDates(
        this.model().start_date,
        this.model().round_interval_days,
        this.roundCount(),
      );
    }
  }

  onRoundDateChange(index: number, event: MatDatepickerInputEvent<Date>): void {
    this.setRoundDate(index, event.value);
  }

  addSource(kind: PlayoffSourceKind = "range"): void {
    this.model.update((model) => ({
      ...model,
      sources: [...model.sources, emptySource(kind)],
    }));
  }

  removeSource(index: number): void {
    this.model.update((model) =>
      model.sources.length > 1
        ? {
            ...model,
            sources: model.sources.filter((_, i) => i !== index),
          }
        : model,
    );
  }

  /** Server messages win over the generic text of the failed rule */
  errorText(errors: readonly ValidationError[]): string {
    const message = errors.find((error) => error.message)?.message;

    if (message) {
      return message;
    }

    switch (errors[0]?.kind) {
      case "maxLength":
        return this.transloco.translate("validation.maxLength", {
          max: NAME_MAX,
        });
      case "days":
        return this.transloco.translate("groups.playoff.daysError");
      case "bestCount":
        return this.transloco.translate("groups.playoff.bestCountError");
      case "position":
      case "positionEnd":
        return this.transloco.translate("groups.playoff.positionError");
      case "roundsOrder":
        return this.transloco.translate("groups.playoff.roundsOrder");
      case "total":
        return this.transloco.translate("groups.playoff.totalError");
      default:
        return this.transloco.translate("validation.required");
    }
  }

  save(): Promise<boolean> {
    this.formError.set(null);

    return this.formSubmit.submit(this.playoffForm, {
      errors: "form",
      onFormError: (message) => this.formError.set(message),
      send: () => {
        const {
          name,
          start_date,
          round_interval_days,
          round_legs,
          round_dates,
          sources,
        } = this.model();
        const dates = round_dates.map((row) => row.date);
        const manual =
          start_date !== null &&
          this.totalValid() &&
          this.edited().size > 0 &&
          dates.every((date) => date !== null);
        const body = {
          name: name.trim(),
          type: "playoff" as const,
          start_date: start_date ? formatDate(start_date) : null,
          round_interval_days: round_interval_days as number,
          ...(manual && {
            round_dates: dates.map((date) => formatDate(date as Date)),
          }),
          ...(!start_date && { round_dates: null }),
          ...(this.totalValid() && {
            round_legs:
              round_legs.length === this.roundCount()
                ? round_legs.map((row) => row.legs)
                : Array.from({ length: this.roundCount() }, (): RoundLegs => 1),
          }),
          sources: sources.map((source): PlayoffSourceBody =>
            source.kind === "best_of_position"
              ? {
                  kind: "best_of_position",
                  position_start: source.position_start as number,
                  position_end: source.position_start as number,
                  best_count: source.best_count as number,
                }
              : {
                  source_group_id: source.source_group_id as number,
                  position_start: source.position_start as number,
                  position_end: source.position_end as number,
                },
          ),
        };

        return this.data.playoff
          ? this.api.update(this.data.tournamentId, this.data.playoff.id, body)
          : this.api.create(this.data.tournamentId, body);
      },
      onSuccess: (saved) => this.dialogRef.close(saved),
    });
  }
}
