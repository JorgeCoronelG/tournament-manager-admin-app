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
import { MatSelectModule } from "@angular/material/select";
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
import { FormSubmitService } from "../../../shared/form-submit.service";
import { User } from "../user.model";
import { UsersApi } from "../users.api";

interface UserFormModel {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  roles: number[];
}

const NAME_MIN = 3;
const NAME_MAX = 100;
const PHONE_PATTERN = /^\d{10}$/;

/** Creates a user, or edits the one passed as dialog data. Closes with the saved user. */
@Component({
  selector: "app-user-form-dialog",
  templateUrl: "./user-form-dialog.component.html",
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
export class UserFormDialogComponent {
  private readonly api = inject(UsersApi);
  private readonly dialogRef =
    inject<MatDialogRef<UserFormDialogComponent, User>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  /** The user being edited; null when creating */
  readonly user = inject<User | null>(MAT_DIALOG_DATA, { optional: true });

  readonly roles = this.api.roles();

  private readonly playerRoleId = computed(
    () => this.roles.value()?.find((role) => role.code === "player")?.id,
  );

  private readonly model = signal<UserFormModel>({
    first_name: this.user?.first_name ?? "",
    last_name: this.user?.last_name ?? "",
    email: this.user?.email ?? "",
    phone: this.user?.phone ?? "",
    roles: this.user?.roles.map((role) => role.id) ?? [],
  });

  readonly userForm = form(this.model, (user) => {
    required(user.first_name);
    minLength(user.first_name, NAME_MIN);
    maxLength(user.first_name, NAME_MAX);
    required(user.last_name);
    minLength(user.last_name, NAME_MIN);
    maxLength(user.last_name, NAME_MAX);
    required(user.email);
    email(user.email);
    // `required` marks the field; an empty array is caught by `minLength`
    required(user.roles);
    minLength(user.roles, 1);
    // Mexican numbers: exactly 10 digits (blank is fine unless a player)
    maxLength(user.phone, 10);
    pattern(user.phone, PHONE_PATTERN);
    // Players are reached by phone
    required(user.phone, {
      when: ({ valueOf }) => {
        const player = this.playerRoleId();

        return player !== undefined && valueOf(user.roles).includes(player);
      },
    });
  });

  /** Server messages win over the generic text of the failed rule */
  errorText(errors: readonly ValidationError[], value: unknown): string {
    const message = errors.find((error) => error.message)?.message;

    if (message) {
      return message;
    }

    const kind = errors[0]?.kind;

    if (kind === "email" && value) {
      return this.transloco.translate("validation.email");
    }

    // Names only; on the roles list a short array just means "required"
    if (
      (kind === "minLength" || kind === "maxLength") &&
      typeof value === "string"
    ) {
      return this.transloco.translate(`validation.${kind}`, {
        min: NAME_MIN,
        max: NAME_MAX,
      });
    }

    if (kind === "pattern") {
      return this.transloco.translate("validation.phone");
    }

    return this.transloco.translate("validation.required");
  }

  save(): Promise<boolean> {
    return this.formSubmit.submit(this.userForm, {
      errors: "form",
      send: () => {
        const { phone, ...rest } = this.model();
        const body = { ...rest, phone: phone.trim() || null };

        return this.user
          ? this.api.update(this.user.id, {
              ...body,
              is_active: this.user.is_active,
            })
          : this.api.create(body);
      },
      onSuccess: (saved) => this.dialogRef.close(saved),
    });
  }
}
