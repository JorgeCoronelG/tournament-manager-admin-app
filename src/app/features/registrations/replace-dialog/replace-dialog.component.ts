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
import { MatRadioModule } from "@angular/material/radio";
import { MatTooltipModule } from "@angular/material/tooltip";
import {
  debounce,
  form,
  FormField,
  maxLength,
  required,
  validate,
  ValidationError,
} from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import {
  AvailableTeam,
  isBanned,
  REASON_MAX,
  REASON_MIN,
  Registration,
  ReplaceResult,
} from "../registration.model";
import { RegistrationsApi } from "../registrations.api";

export interface ReplaceDialogData {
  tournamentId: number;
  registration: Registration;
}

/**
 * Swaps a team of a tournament in progress for another one of the league. The
 * new team inherits the matches and points. Closes with the result once the
 * backend accepted it; a refusal stays in the dialog.
 */
@Component({
  selector: "app-replace-dialog",
  templateUrl: "./replace-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    LogoImageComponent,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatRadioModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
})
export class ReplaceDialogComponent {
  private readonly api = inject(RegistrationsApi);
  private readonly dialogRef =
    inject<MatDialogRef<ReplaceDialogComponent, ReplaceResult>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<ReplaceDialogData>(MAT_DIALOG_DATA);
  readonly team = this.data.registration.team;

  readonly filters = signal({ search: "" });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  private readonly candidates = this.api.available(
    this.data.tournamentId,
    computed(() => this.filters().search),
  );

  readonly resource = this.candidates.resource;
  readonly teams = computed(() => this.candidates.rows() ?? []);

  /** The team that takes the place; kept across searches */
  readonly selected = signal<AvailableTeam | null>(null);

  private readonly model = signal({ reason: "" });

  /** A refusal that belongs to no field */
  readonly serverError = signal<string | null>(null);

  readonly replaceForm = form(this.model, (value) => {
    required(value.reason);
    validate(value.reason, ({ value: reason }) =>
      reason().trim().length > 0 && reason().trim().length < REASON_MIN
        ? { kind: "minLength" }
        : undefined,
    );
    maxLength(value.reason, REASON_MAX);
  });

  readonly canSave = computed(
    () => this.selected() !== null && this.replaceForm().valid(),
  );

  protected readonly isBanned = isBanned;

  pick(team: AvailableTeam): void {
    if (!isBanned(team)) {
      this.serverError.set(null);
      this.selected.set(team);
    }
  }

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
    const selected = this.selected();

    if (!selected) {
      return Promise.resolve(false);
    }

    this.serverError.set(null);

    return this.formSubmit.submit(this.replaceForm, {
      errors: "form",
      onFormError: (message) => this.serverError.set(message),
      send: () =>
        this.api.replace(
          this.data.tournamentId,
          this.data.registration.id,
          selected.id,
          this.model().reason,
        ),
      onSuccess: (result) => this.dialogRef.close(result),
    });
  }
}
