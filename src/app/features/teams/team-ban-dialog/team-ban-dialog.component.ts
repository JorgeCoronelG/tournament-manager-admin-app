import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import {
  form,
  FormField,
  maxLength,
  required,
  validate,
  ValidationError,
} from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { ScrollFadeComponent } from "../../../shared/scroll-fade/scroll-fade.component";
import { TournamentStatusChipComponent } from "../../tournaments/tournament-status-chip/tournament-status-chip.component";
import { BannedTeam, Team } from "../team.model";
import { TeamsApi } from "../teams.api";

export interface TeamBanDialogData {
  team: Team;
  /** "Halcones (delegado: Luis Pérez)": teams can share a name */
  label: string;
}

const REASON_MIN = 5;
const REASON_MAX = 255;

/**
 * Asks why a team is banned and shows which tournaments it touches. Closes with
 * the banned team (and what it did) once the backend accepted it.
 */
@Component({
  selector: "app-team-ban-dialog",
  templateUrl: "./team-ban-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollFadeComponent,
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    TournamentStatusChipComponent,
    TranslocoPipe,
  ],
})
export class TeamBanDialogComponent {
  private readonly api = inject(TeamsApi);
  private readonly dialogRef =
    inject<MatDialogRef<TeamBanDialogComponent, BannedTeam>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<TeamBanDialogData>(MAT_DIALOG_DATA);

  protected readonly preview = this.api.banPreview(this.data.team.id);
  readonly tournaments = computed(() =>
    this.preview.hasValue() ? this.preview.value().tournaments : [],
  );

  private readonly model = signal({ reason: "" });

  /** A refusal that belongs to no field */
  readonly serverError = signal<string | null>(null);

  readonly banForm = form(this.model, (value) => {
    required(value.reason);
    validate(value.reason, ({ value: reason }) =>
      reason().trim().length > 0 && reason().trim().length < REASON_MIN
        ? { kind: "minLength" }
        : undefined,
    );
    maxLength(value.reason, REASON_MAX);
  });

  /** Server messages win over the generic text of the failed rule */
  errorText(errors: readonly ValidationError[]): string {
    const message = errors.find((error) => error.message)?.message;

    if (message) {
      return message;
    }

    switch (errors[0]?.kind) {
      case "minLength":
        return this.transloco.translate("validation.minLength", {
          min: REASON_MIN,
        });
      case "maxLength":
        return this.transloco.translate("validation.maxLength", {
          max: REASON_MAX,
        });
      default:
        return this.transloco.translate("validation.required");
    }
  }

  save(): Promise<boolean> {
    this.serverError.set(null);

    return this.formSubmit.submit(this.banForm, {
      errors: "form",
      onFormError: (message) => this.serverError.set(message),
      send: () => this.api.ban(this.data.team.id, this.model().reason),
      onSuccess: (team) => this.dialogRef.close(team),
    });
  }
}
