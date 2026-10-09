import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDatepickerModule } from "@angular/material/datepicker";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
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
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import {
  MAX_AGE,
  MIN_AGE,
  formatDate,
  parseDate,
  TOURNAMENT_GENDERS,
  Tournament,
  TournamentGender,
} from "../tournament.model";
import { TournamentsApi } from "../tournaments.api";

interface TournamentFormModel {
  name: string;
  gender: TournamentGender | "";
  min_age: number | null;
  max_age: number | null;
  start_date: Date | null;
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
    MatInputModule,
    MatSelectModule,
    TranslocoPipe,
  ],
})
export class TournamentFormDialogComponent {
  private readonly api = inject(TournamentsApi);
  private readonly dialogRef =
    inject<MatDialogRef<TournamentFormDialogComponent, Tournament>>(
      MatDialogRef,
    );
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  /** The tournament being edited; null when creating */
  readonly tournament = inject<Tournament | null>(MAT_DIALOG_DATA, {
    optional: true,
  });

  readonly genders = TOURNAMENT_GENDERS;

  private readonly model = signal<TournamentFormModel>({
    name: this.tournament?.name ?? "",
    gender: this.tournament?.gender ?? "",
    min_age: this.tournament?.min_age ?? null,
    max_age: this.tournament?.max_age ?? null,
    start_date: this.tournament ? parseDate(this.tournament.start_date) : null,
  });

  readonly tournamentForm = form(this.model, (tournament) => {
    required(tournament.name);
    maxLength(tournament.name, NAME_MAX);
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

    // In progress only the name changes (the backend rejects the rest)
    const locked = () => this.tournament?.status === "in_progress";
    disabled(tournament.gender, locked);
    disabled(tournament.min_age, locked);
    disabled(tournament.max_age, locked);
    disabled(tournament.start_date, locked);
  });

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
      case "min":
      case "max":
        return this.transloco.translate("tournaments.form.ageBounds", {
          min: MIN_AGE,
          max: MAX_AGE,
        });
      case "ageRange":
        return this.transloco.translate("tournaments.form.ageRange");
      default:
        return this.transloco.translate("validation.required");
    }
  }

  save(): Promise<boolean> {
    return this.formSubmit.submit(this.tournamentForm, {
      errors: "form",
      send: () => {
        const { name, gender, min_age, max_age, start_date } = this.model();
        const body = {
          name: name.trim(),
          gender: gender as TournamentGender,
          min_age,
          max_age,
          start_date: formatDate(start_date as Date),
        };

        return this.tournament
          ? this.api.update(this.tournament.id, body)
          : this.api.create(body);
      },
      onSuccess: (saved) => this.dialogRef.close(saved),
    });
  }
}
