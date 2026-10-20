import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { form } from "@angular/forms/signals";
import { TranslocoPipe } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { ManagerFieldsComponent } from "../manager-fields/manager-fields.component";
import {
  applyManagerRules,
  emptyManager,
  ManagerMode,
  ManagerModel,
  managerInput,
} from "../manager-form";
import { ManagerInput, ManagerLookup, Team } from "../team.model";
import { TeamsApi } from "../teams.api";

/**
 * Assigns a delegate to the team passed as dialog data, or replaces the one it
 * has: a new user or an existing one by code. Closes with the updated team.
 */
@Component({
  selector: "app-team-manager-dialog",
  templateUrl: "./team-manager-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ManagerFieldsComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    TranslocoPipe,
  ],
})
export class TeamManagerDialogComponent {
  private readonly api = inject(TeamsApi);
  private readonly dialogRef =
    inject<MatDialogRef<TeamManagerDialogComponent, Team>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);

  readonly team = inject<Team>(MAT_DIALOG_DATA);

  readonly modes: readonly ManagerMode[] = ["new", "code"];
  readonly found = signal<ManagerLookup | undefined>(undefined);
  /** What the server said when it refused the change (e.g. a repeated name) */
  readonly serverError = signal<string | null>(null);

  private readonly model = signal<ManagerModel>(emptyManager("new"));

  // The refusal belongs to the delegate that was sent: any change of the mode,
  // the code or the data, or a different delegate found, makes it stale
  private readonly clearStaleError = effect(() => {
    this.model();
    this.found();
    this.serverError.set(null);
  });

  readonly managerForm = form(this.model, (manager) => {
    applyManagerRules(manager);
  });

  /** With a code, the delegate has to be found first */
  canSave(): boolean {
    return (
      !this.managerForm().submitting() &&
      (this.model().mode !== "code" || !!this.found())
    );
  }

  save(): Promise<boolean> {
    return this.formSubmit.submit(this.managerForm, {
      errors: "form",
      onFormError: (message) => this.serverError.set(message),
      send: () => {
        this.serverError.set(null);

        // The modes are only "new" and "code", so there is always a delegate
        const manager = managerInput(this.model()) as ManagerInput;

        return this.api.setManager(this.team.id, manager);
      },
      onSuccess: (saved) => this.dialogRef.close(saved),
    });
  }
}
