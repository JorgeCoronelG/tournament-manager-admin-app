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
import { MatInputModule } from "@angular/material/input";
import {
  form,
  FormField,
  maxLength,
  required,
  validate,
  ValidationError,
} from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { catchError, map, Observable, of, switchMap, throwError } from "rxjs";
import { fieldErrors } from "../../../core/http/api-errors";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { formUnchanged } from "../../../shared/form-unchanged/form-unchanged";
import { LogoPickerComponent } from "../../../shared/logo-picker/logo-picker.component";
import { ManagerFieldsComponent } from "../manager-fields/manager-fields.component";
import {
  applyManagerRules,
  emptyManager,
  ManagerMode,
  ManagerModel,
  managerInput,
} from "../manager-form";
import { ManagerLookup, Team } from "../team.model";
import { TeamsApi } from "../teams.api";

export const TEAM_NAME_MAX = 150;

/** What the dialog closes with: the saved team and whether its logo failed */
export interface TeamFormResult {
  team: Team;
  logoFailed: boolean;
}

type TeamFormModel = ManagerModel & { name: string };

/**
 * Creates a team (with its delegate, if given) or edits the one passed as
 * dialog data (name and logo). The team is saved first and the logo uploaded
 * after: if only the logo fails the dialog still closes, saying so.
 */
@Component({
  selector: "app-team-form-dialog",
  templateUrl: "./team-form-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    LogoPickerComponent,
    ManagerFieldsComponent,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
})
export class TeamFormDialogComponent {
  private readonly api = inject(TeamsApi);
  private readonly dialogRef =
    inject<MatDialogRef<TeamFormDialogComponent, TeamFormResult>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  /** The team being edited; null when creating */
  readonly team = inject<Team | null>(MAT_DIALOG_DATA, { optional: true });

  readonly managerModes: readonly ManagerMode[] = ["none", "new", "code"];

  /** The new logo chosen, and whether the current one was removed */
  readonly logoFile = signal<File | null>(null);
  readonly logoRemoved = signal(false);
  /** The delegate found for the code in the form */
  readonly found = signal<ManagerLookup | undefined>(undefined);

  private readonly model = signal<TeamFormModel>({
    ...emptyManager("none"),
    name: this.team?.name ?? "",
  });

  /** Editing with the same name and no logo change: Save stays disabled */
  private readonly sameValues = formUnchanged(this.model);
  private readonly unchanged = computed(
    () =>
      this.team !== null &&
      this.sameValues() &&
      this.logoFile() === null &&
      !this.logoRemoved(),
  );

  /**
   * The name the server rejected as repeated. Whether it is repeated depends on
   * the name *and* the delegate, so it is checked here (not as a field
   * submission error, which only clears when the name itself changes) and stops
   * applying as soon as either one changes.
   */
  private readonly taken = signal<{ key: string; message: string } | null>(
    null,
  );

  readonly teamForm = form(this.model, (team) => {
    required(team.name);
    maxLength(team.name, TEAM_NAME_MAX);
    validate(team.name, () => {
      const taken = this.taken();

      return taken && taken.key === this.nameAndManagerKey()
        ? { kind: "server", message: taken.message }
        : undefined;
    });
    applyManagerRules(team);
  });

  /** What the server judges a repeated name by: the name and who the delegate is */
  private nameAndManagerKey(): string {
    const model = this.model();

    return JSON.stringify([model.name.trim(), managerInput(model) ?? null]);
  }

  /** Server messages (e.g. a repeated name) win over the text of the failed rule */
  errorText(errors: readonly ValidationError[]): string {
    const message = errors.find((error) => error.message)?.message;

    if (message) {
      return message;
    }

    return errors[0]?.kind === "maxLength"
      ? this.transloco.translate("validation.maxLength", {
          max: TEAM_NAME_MAX,
        })
      : this.transloco.translate("validation.required");
  }

  /** With a code, the delegate has to be found first */
  canSave(): boolean {
    return (
      !this.teamForm().submitting() &&
      !this.unchanged() &&
      (this.model().mode !== "code" || !!this.found())
    );
  }

  save(): Promise<boolean> {
    return this.formSubmit.submit(this.teamForm, {
      errors: "form",
      ignoreFields: ["name"],
      send: () => {
        const model = this.model();
        const name = model.name.trim();
        const manager = managerInput(model);
        const key = this.nameAndManagerKey();

        return (
          this.team
            ? this.api.update(this.team.id, { name })
            : this.api.create({ name, ...(manager ? { manager } : {}) })
        ).pipe(
          catchError((error: unknown) => {
            const message = fieldErrors(error)?.["name"]?.join(" ");

            if (message) {
              this.taken.set({ key, message });
            }

            return throwError(() => error);
          }),
          switchMap((team) => this.syncLogo(team)),
        );
      },
      onSuccess: (result) => this.dialogRef.close(result),
    });
  }

  /** Uploads or removes the logo; a failure here does not undo the saved team */
  private syncLogo(team: Team): Observable<TeamFormResult> {
    const file = this.logoFile();
    const request =
      file !== null
        ? this.api.uploadLogo(team.id, file)
        : this.logoRemoved() && this.team
          ? this.api.removeLogo(team.id)
          : null;

    if (!request) {
      return of({ team, logoFailed: false });
    }

    return (request as Observable<Team | void>).pipe(
      map((updated) => ({
        team: updated && "id" in updated ? updated : team,
        logoFailed: false,
      })),
      catchError(() => of({ team, logoFailed: true })),
    );
  }
}
