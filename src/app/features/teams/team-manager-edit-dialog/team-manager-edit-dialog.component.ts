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
import { form } from "@angular/forms/signals";
import { TranslocoPipe } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { ManagerFieldsComponent } from "../manager-fields/manager-fields.component";
import {
  applyManagerRules,
  ManagerMode,
  ManagerModel,
  managerInput,
} from "../manager-form";
import { NewManager, Team } from "../team.model";
import { TeamsApi } from "../teams.api";

/**
 * Edits the data of the delegate of the team passed as dialog data, whose
 * account is still pending. Closes with the updated team.
 */
@Component({
  selector: "app-team-manager-edit-dialog",
  templateUrl: "./team-manager-edit-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ManagerFieldsComponent,
    MatButtonModule,
    MatDialogModule,
    TranslocoPipe,
  ],
})
export class TeamManagerEditDialogComponent {
  private readonly api = inject(TeamsApi);
  private readonly dialogRef =
    inject<MatDialogRef<TeamManagerEditDialogComponent, Team>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);

  readonly team = inject<Team>(MAT_DIALOG_DATA);

  readonly modes: readonly ManagerMode[] = ["new"];

  private readonly model = signal<ManagerModel>({
    mode: "new",
    first_name: this.team.manager?.first_name ?? "",
    last_name: this.team.manager?.last_name ?? "",
    email: this.team.manager?.email ?? "",
    phone: this.team.manager?.phone ?? "",
    user_code: "",
  });

  readonly managerForm = form(this.model, (manager) => {
    applyManagerRules(manager);
  });

  save(): Promise<boolean> {
    return this.formSubmit.submit(this.managerForm, {
      errors: "form",
      // Mode "new" always gives the delegate's data
      send: () =>
        this.api.updateManager(
          this.team.id,
          managerInput(this.model()) as NewManager,
        ),
      onSuccess: (saved) => this.dialogRef.close(saved),
    });
  }
}
