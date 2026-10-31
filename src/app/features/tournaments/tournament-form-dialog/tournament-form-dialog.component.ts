import {
  ChangeDetectionStrategy,
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDatepickerModule } from "@angular/material/datepicker";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatIconModule } from "@angular/material/icon";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import {
  disabled,
  form,
  FormField,
  max,
  maxLength,
  min,
  required,
  validate,
  ValidationError,
} from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { catchError, throwError } from "rxjs";
import { fieldErrors } from "../../../core/http/api-errors";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { formUnchanged } from "../../../shared/form-unchanged/form-unchanged";
import {
  DEFAULT_MATCH_DURATION,
  DEFAULT_WALKOVER_GOALS,
  DEFAULT_ROUNDS,
  DEFAULT_TIEBREAKERS,
  MAX_AGE,
  MAX_MATCH_DURATION,
  MAX_WALKOVER_GOALS,
  MIN_AGE,
  MIN_MATCH_DURATION,
  MIN_WALKOVER_GOALS,
  formatDate,
  parseDate,
  TIEBREAKERS,
  TOURNAMENT_GENDERS,
  TOURNAMENT_ROUNDS,
  Tiebreaker,
  Tournament,
  TournamentGender,
  TournamentRounds,
} from "../tournament.model";
import { TournamentsApi } from "../tournaments.api";

interface TournamentFormModel {
  name: string;
  gender: TournamentGender | "";
  min_age: number | null;
  max_age: number | null;
  start_date: Date | null;
  max_roster_size: number | null;
  min_matches_for_playoffs: number | null;
  rounds: TournamentRounds;
  match_duration_minutes: number | null;
  walkover_goals: number | null;
  tiebreakers: Tiebreaker[];
}

const NAME_MAX = 150;

/**
 * Creates a tournament, or edits the one passed as dialog data. Once a
 * tournament is in progress only its name can change; a finished one is not
 * edited at all. Closes with the saved tournament.
 */
@Component({
  selector: "app-tournament-form-dialog",
  templateUrl: "./tournament-form-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
})
export class TournamentFormDialogComponent {
  private readonly api = inject(TournamentsApi);
  private readonly dialogRef =
    inject<MatDialogRef<TournamentFormDialogComponent, Tournament>>(
      MatDialogRef,
    );
  private readonly injector = inject(Injector);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  /** The tournament being edited; null when creating */
  readonly tournament = inject<Tournament | null>(MAT_DIALOG_DATA, {
    optional: true,
  });

  private readonly tiebreakersError =
    viewChild<ElementRef<HTMLElement>>("tiebreakersError");

  /** 0 is General (required fields), 1 is Configuración (optional ones) */
  readonly selectedTab = signal(0);

  readonly genders = TOURNAMENT_GENDERS;
  readonly rounds = TOURNAMENT_ROUNDS;

  private readonly model = signal<TournamentFormModel>({
    name: this.tournament?.name ?? "",
    gender: this.tournament?.gender ?? "",
    min_age: this.tournament?.min_age ?? null,
    max_age: this.tournament?.max_age ?? null,
    start_date: this.tournament ? parseDate(this.tournament.start_date) : null,
    max_roster_size: this.tournament?.max_roster_size ?? null,
    min_matches_for_playoffs: this.tournament?.min_matches_for_playoffs ?? null,
    rounds: this.tournament?.rounds ?? DEFAULT_ROUNDS,
    match_duration_minutes:
      this.tournament?.match_duration_minutes ?? DEFAULT_MATCH_DURATION,
    walkover_goals: this.tournament?.walkover_goals ?? DEFAULT_WALKOVER_GOALS,
    tiebreakers: [...(this.tournament?.tiebreakers ?? DEFAULT_TIEBREAKERS)],
  });

  /** Editing with the same values as when it opened: Save stays disabled */
  private readonly sameValues = formUnchanged(this.model);
  readonly unchanged = computed(
    () => this.tournament !== null && this.sameValues(),
  );

  /** Criteria not yet in the list, in their canonical order */
  readonly availableTiebreakers = computed(() => {
    const used = this.model().tiebreakers;

    return TIEBREAKERS.filter((criterion) => !used.includes(criterion));
  });

  /**
   * The name/gender pair the server rejected as taken in this league. The rule
   * spans both fields, so it is checked here (not as a field submission error)
   * and clears as soon as either one changes.
   */
  private readonly taken = signal<{
    name: string;
    gender: TournamentGender | "";
    message: string;
  } | null>(null);

  readonly tournamentForm = form(this.model, (tournament) => {
    required(tournament.name);
    maxLength(tournament.name, NAME_MAX);
    validate(tournament.name, ({ value, valueOf }) => {
      const taken = this.taken();

      return taken &&
        taken.name === value().trim() &&
        taken.gender === valueOf(tournament.gender)
        ? { kind: "server", message: taken.message }
        : undefined;
    });
    required(tournament.gender);
    required(tournament.start_date);
    min(tournament.min_age, MIN_AGE);
    max(tournament.min_age, MAX_AGE);
    min(tournament.max_age, MIN_AGE);
    max(tournament.max_age, MAX_AGE);
    validate(tournament.max_age, ({ value, valueOf }) => {
      const minAge = valueOf(tournament.min_age);
      const maxAge = value();

      return minAge !== null && maxAge !== null && minAge > maxAge
        ? { kind: "ageRange" }
        : undefined;
    });

    for (const field of [
      tournament.max_roster_size,
      tournament.min_matches_for_playoffs,
    ]) {
      validate(field, ({ value }) => {
        const amount = value();

        return amount !== null && !(Number.isInteger(amount) && amount >= 1)
          ? { kind: "positiveInteger" }
          : undefined;
      });
    }

    validate(tournament.match_duration_minutes, ({ value }) => {
      const minutes = value();

      return minutes === null ||
        !Number.isInteger(minutes) ||
        minutes < MIN_MATCH_DURATION ||
        minutes > MAX_MATCH_DURATION
        ? { kind: "durationRange" }
        : undefined;
    });
    validate(tournament.walkover_goals, ({ value }) => {
      const goals = value();

      return goals === null ||
        !Number.isInteger(goals) ||
        goals < MIN_WALKOVER_GOALS ||
        goals > MAX_WALKOVER_GOALS
        ? { kind: "walkoverRange" }
        : undefined;
    });
    validate(tournament.tiebreakers, ({ value }) =>
      value().length === 0 ? { kind: "tiebreakersRequired" } : undefined,
    );

    // In progress or in its playoffs only the name changes (the backend rejects the rest)
    const locked = () =>
      this.tournament?.status === "in_progress" ||
      this.tournament?.status === "playoffs";
    disabled(tournament.gender, locked);
    disabled(tournament.min_age, locked);
    disabled(tournament.max_age, locked);
    disabled(tournament.start_date, locked);
    disabled(tournament.max_roster_size, locked);
    disabled(tournament.min_matches_for_playoffs, locked);

    // A finished tournament is not edited at all; the new fields also stay
    // closed once it is in progress (the form dialog explains why)
    const closed = () =>
      this.tournament?.status !== undefined &&
      this.tournament.status !== "planning";
    disabled(tournament.rounds, closed);
    disabled(tournament.match_duration_minutes, closed);
    disabled(tournament.tiebreakers, closed);

    // The default win can still change in progress, but not in the playoffs
    disabled(
      tournament.walkover_goals,
      () =>
        this.tournament?.status === "playoffs" ||
        this.tournament?.status === "finished",
    );
  });

  /** An error in the hidden tab would block saving with nothing visible */
  private showFirstInvalidTab(): void {
    const form = this.tournamentForm;
    const general = [
      form.name,
      form.gender,
      form.start_date,
      form.match_duration_minutes,
      form.walkover_goals,
    ];

    if (general.some((field) => field().invalid())) {
      this.selectedTab.set(0);
    } else if (form().invalid()) {
      this.selectedTab.set(1);

      if (form.tiebreakers().invalid()) {
        // After the tab renders, so the message is in the DOM to scroll to
        afterNextRender(
          () =>
            this.tiebreakersError()?.nativeElement.scrollIntoView({
              block: "nearest",
              behavior: "smooth",
            }),
          { injector: this.injector },
        );
      }
    }
  }

  moveTiebreaker(index: number, offset: -1 | 1): void {
    this.model.update((model) => {
      const target = index + offset;
      const list = [...model.tiebreakers];

      if (target < 0 || target >= list.length) {
        return model;
      }

      [list[index], list[target]] = [list[target], list[index]];

      return { ...model, tiebreakers: list };
    });
  }

  removeTiebreaker(index: number): void {
    this.model.update((model) => ({
      ...model,
      tiebreakers: model.tiebreakers.filter((_, i) => i !== index),
    }));
  }

  addTiebreaker(criterion: Tiebreaker): void {
    this.model.update((model) => ({
      ...model,
      tiebreakers: [...model.tiebreakers, criterion],
    }));
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
      case "positiveInteger":
        return this.transloco.translate("tournaments.form.positiveInteger");
      case "min":
      case "max":
        return this.transloco.translate("tournaments.form.ageBounds", {
          min: MIN_AGE,
          max: MAX_AGE,
        });
      case "durationRange":
        return this.transloco.translate("tournaments.form.durationRange", {
          min: MIN_MATCH_DURATION,
          max: MAX_MATCH_DURATION,
        });
      case "walkoverRange":
        return this.transloco.translate("tournaments.form.walkoverRange", {
          min: MIN_WALKOVER_GOALS,
          max: MAX_WALKOVER_GOALS,
        });
      case "tiebreakersRequired":
        return this.transloco.translate("tournaments.form.tiebreakersRequired");
      case "ageRange":
        return this.transloco.translate("tournaments.form.ageRange");
      default:
        return this.transloco.translate("validation.required");
    }
  }

  save(): Promise<boolean> {
    this.showFirstInvalidTab();

    return this.formSubmit.submit(this.tournamentForm, {
      errors: "form",
      ignoreFields: ["name"],
      send: () => {
        const {
          name,
          gender,
          min_age,
          max_age,
          start_date,
          max_roster_size,
          min_matches_for_playoffs,
          rounds,
          match_duration_minutes,
          walkover_goals,
          tiebreakers,
        } = this.model();
        const body = {
          name: name.trim(),
          gender: gender as TournamentGender,
          min_age,
          max_age,
          start_date: formatDate(start_date as Date),
          max_roster_size,
          min_matches_for_playoffs,
          rounds,
          match_duration_minutes: match_duration_minutes as number,
          walkover_goals: walkover_goals as number,
          tiebreakers,
        };

        const request = this.tournament
          ? this.api.update(this.tournament.id, body)
          : this.api.create(body);

        return request.pipe(
          catchError((error: unknown) => {
            const message = fieldErrors(error)?.["name"]?.join(" ");

            if (message) {
              this.taken.set({ name: body.name, gender, message });
            }

            return throwError(() => error);
          }),
        );
      },
      onSuccess: (saved) => this.dialogRef.close(saved),
    });
  }
}
