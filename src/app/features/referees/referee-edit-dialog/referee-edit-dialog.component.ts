import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { MatButtonModule } from "@angular/material/button";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import {
  email,
  form,
  FormField,
  maxLength,
  minLength,
  pattern,
  required,
  ValidationError,
} from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { tap } from "rxjs";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { formUnchanged } from "../../../shared/form-unchanged/form-unchanged";
import { Referee } from "../referee.model";
import {
  NAME_MAX,
  NAME_MIN,
  PHONE_PATTERN,
  refereeErrorText,
} from "../referee-form";
import { RefereesApi } from "../referees.api";

interface RefereeFormModel {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

/**
 * Edits the data of a referee whose account is still pending. Closes with the
 * saved referee.
 */
@Component({
  selector: "app-referee-edit-dialog",
  templateUrl: "./referee-edit-dialog.component.html",
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
export class RefereeEditDialogComponent {
  private readonly api = inject(RefereesApi);
  private readonly dialogRef =
    inject<MatDialogRef<RefereeEditDialogComponent, Referee>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly referee = inject<Referee>(MAT_DIALOG_DATA);

  /** The backend refused the change: they may belong to other leagues */
  readonly rejected = signal(false);

  private readonly model = signal<RefereeFormModel>({
    first_name: this.referee.first_name,
    last_name: this.referee.last_name,
    email: this.referee.email,
    phone: this.referee.phone ?? "",
  });

  /** The same values as when it opened: Save stays disabled */
  readonly unchanged = formUnchanged(this.model);

  readonly refereeForm = form(this.model, (referee) => {
    required(referee.first_name);
    minLength(referee.first_name, NAME_MIN);
    maxLength(referee.first_name, NAME_MAX);
    required(referee.last_name);
    minLength(referee.last_name, NAME_MIN);
    maxLength(referee.last_name, NAME_MAX);
    required(referee.email);
    email(referee.email);
    // Mexican numbers: exactly 10 digits (optional)
    maxLength(referee.phone, 10);
    pattern(referee.phone, PHONE_PATTERN);
  });

  /** Server messages win over the generic text of the failed rule */
  errorText(errors: readonly ValidationError[], value: unknown): string {
    return refereeErrorText(this.transloco, errors, value);
  }

  save(): Promise<boolean> {
    this.rejected.set(false);

    return this.formSubmit.submit(this.refereeForm, {
      errors: "form",
      send: () => {
        const { phone, ...rest } = this.model();

        return this.api
          .update(this.referee.id, {
            ...rest,
            first_name: rest.first_name.trim(),
            last_name: rest.last_name.trim(),
            email: rest.email.trim(),
            phone: phone.trim() || null,
          })
          .pipe(
            tap({
              error: (error: unknown) => {
                if (
                  error instanceof HttpErrorResponse &&
                  error.status === 422
                ) {
                  this.rejected.set(true);
                }
              },
            }),
          );
      },
      onSuccess: (saved) => this.dialogRef.close(saved),
    });
  }
}
