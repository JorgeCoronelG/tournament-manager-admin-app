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
  ValidationError,
} from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { Group } from "../group.model";
import { GroupsApi } from "../groups.api";

export interface GroupFormDialogData {
  tournamentId: number;
  /** The group to rename; absent when creating */
  group?: Group;
}

export const GROUP_NAME_MAX = 100;

/** Creates a regular group, or renames the one passed as data. Closes with the saved group. */
@Component({
  selector: "app-group-form-dialog",
  templateUrl: "./group-form-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
})
export class GroupFormDialogComponent {
  private readonly api = inject(GroupsApi);
  private readonly dialogRef =
    inject<MatDialogRef<GroupFormDialogComponent, Group>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<GroupFormDialogData>(MAT_DIALOG_DATA);

  private readonly model = signal({ name: this.data.group?.name ?? "" });

  readonly groupForm = form(this.model, (group) => {
    required(group.name);
    maxLength(group.name, GROUP_NAME_MAX);
  });

  /** Server messages (e.g. a repeated name) win over the text of the failed rule */
  errorText(errors: readonly ValidationError[]): string {
    const message = errors.find((error) => error.message)?.message;

    if (message) {
      return message;
    }

    return errors[0]?.kind === "maxLength"
      ? this.transloco.translate("validation.maxLength", {
          max: GROUP_NAME_MAX,
        })
      : this.transloco.translate("validation.required");
  }

  save(): Promise<boolean> {
    return this.formSubmit.submit(this.groupForm, {
      errors: "form",
      send: () => {
        const body = { name: this.model().name.trim() };

        return this.data.group
          ? this.api.update(this.data.tournamentId, this.data.group.id, body)
          : this.api.create(this.data.tournamentId, body);
      },
      onSuccess: (saved) => this.dialogRef.close(saved),
    });
  }
}
