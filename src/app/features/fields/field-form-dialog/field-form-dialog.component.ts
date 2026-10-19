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
import { MatSelectModule } from "@angular/material/select";
import {
  form,
  FormField,
  maxLength,
  required,
  ValidationError,
} from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { Field, FIELD_STATUSES, FieldStatus } from "../field.model";
import { FieldsApi } from "../fields.api";

interface FieldFormModel {
  name: string;
  status: FieldStatus;
}

export const FIELD_NAME_MAX = 150;

/**
 * Creates a field, or edits the one passed as dialog data (only its name: the
 * status changes from the list). Closes with the saved field.
 */
@Component({
  selector: "app-field-form-dialog",
  templateUrl: "./field-form-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TranslocoPipe,
  ],
})
export class FieldFormDialogComponent {
  private readonly api = inject(FieldsApi);
  private readonly dialogRef =
    inject<MatDialogRef<FieldFormDialogComponent, Field>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  /** The field being edited; null when creating */
  readonly field = inject<Field | null>(MAT_DIALOG_DATA, { optional: true });

  readonly statuses = FIELD_STATUSES;

  private readonly model = signal<FieldFormModel>({
    name: this.field?.name ?? "",
    status: "active",
  });

  readonly fieldForm = form(this.model, (field) => {
    required(field.name);
    maxLength(field.name, FIELD_NAME_MAX);
  });

  /** Server messages (e.g. a repeated name) win over the text of the failed rule */
  errorText(errors: readonly ValidationError[]): string {
    const message = errors.find((error) => error.message)?.message;

    if (message) {
      return message;
    }

    return errors[0]?.kind === "maxLength"
      ? this.transloco.translate("validation.maxLength", {
          max: FIELD_NAME_MAX,
        })
      : this.transloco.translate("validation.required");
  }

  save(): Promise<boolean> {
    return this.formSubmit.submit(this.fieldForm, {
      errors: "form",
      send: () => {
        const { name, status } = this.model();
        const trimmed = name.trim();

        return this.field
          ? this.api.update(this.field.id, { name: trimmed })
          : this.api.create({ name: trimmed, status });
      },
      onSuccess: (saved) => this.dialogRef.close(saved),
    });
  }
}
