import {
  ChangeDetectionStrategy,
  Component,
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
import { MatInputModule } from "@angular/material/input";
import {
  form,
  FormField,
  maxLength,
  required,
  validate,
  ValidationError,
} from "@angular/forms/signals";
import { catchError, throwError } from "rxjs";
import { fieldErrors } from "../../../core/http/api-errors";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { LeagueAdminSelectComponent } from "../league-admin-select/league-admin-select.component";
import { League } from "../league.model";
import { LeaguesApi } from "../leagues.api";

interface LeagueFormModel {
  name: string;
  /** `""` until a manager is chosen */
  admin_user_id: number | "";
}

const NAME_MAX = 150;

/** Creates a league, or edits the one passed as dialog data. Closes with the saved league. */
@Component({
  selector: "app-league-form-dialog",
  templateUrl: "./league-form-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    LeagueAdminSelectComponent,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
})
export class LeagueFormDialogComponent {
  private readonly api = inject(LeaguesApi);
  private readonly dialogRef =
    inject<MatDialogRef<LeagueFormDialogComponent, League>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  /** The league being edited; null when creating */
  readonly league = inject<League | null>(MAT_DIALOG_DATA, { optional: true });

  private readonly model = signal<LeagueFormModel>({
    name: this.league?.name ?? "",
    admin_user_id: this.league?.admin.id ?? "",
  });

  /**
   * The name/manager pair the server rejected as taken. The rule spans both
   * fields, so it is checked here (not as a field submission error) and clears
   * as soon as either one changes.
   */
  private readonly taken = signal<{
    name: string;
    adminId: number | "";
    message: string;
  } | null>(null);

  readonly leagueForm = form(this.model, (league) => {
    required(league.name);
    maxLength(league.name, NAME_MAX);
    validate(league.name, ({ value, valueOf }) => {
      const taken = this.taken();

      return taken &&
        taken.name === value().trim() &&
        taken.adminId === valueOf(league.admin_user_id)
        ? { kind: "server", message: taken.message }
        : undefined;
    });
    // The manager is picked from the list, never typed
    required(league.admin_user_id);
  });

  /** Server messages win over the generic text of the failed rule */
  errorText(errors: readonly ValidationError[]): string {
    const message = errors.find((error) => error.message)?.message;

    if (message) {
      return message;
    }

    return errors[0]?.kind === "maxLength"
      ? this.transloco.translate("validation.maxLength", { max: NAME_MAX })
      : this.transloco.translate("validation.required");
  }

  save(): Promise<boolean> {
    return this.formSubmit.submit(this.leagueForm, {
      errors: "form",
      ignoreFields: ["name"],
      send: () => {
        const { name, admin_user_id } = this.model();
        const body = {
          name: name.trim(),
          admin_user_id: Number(admin_user_id),
        };

        const request = this.league
          ? this.api.update(this.league.id, body)
          : this.api.create(body);

        return request.pipe(
          catchError((error: unknown) => {
            const message = fieldErrors(error)?.["name"]?.join(" ");

            if (message) {
              this.taken.set({
                name: body.name,
                adminId: body.admin_user_id,
                message,
              });
            }

            return throwError(() => error);
          }),
        );
      },
      onSuccess: (saved) => this.dialogRef.close(saved),
    });
  }
}
