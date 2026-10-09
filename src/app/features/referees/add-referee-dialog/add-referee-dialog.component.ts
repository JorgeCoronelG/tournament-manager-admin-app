import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatTabsModule } from "@angular/material/tabs";
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
import { AppAvatarComponent } from "@ui/components/app-avatar/app-avatar.component";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import {
  NAME_MAX,
  NAME_MIN,
  PHONE_PATTERN,
  refereeErrorText,
} from "../referee-form";
import { RefereesApi } from "../referees.api";

/** What the dialog closes with, so the list can say what happened */
export type AddRefereeResult = "created" | "attached";

const NEW_TAB = 0;
const CODE_TAB = 1;

interface NewRefereeModel {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

/**
 * Adds a referee to the active league: a brand new one (who gets an activation
 * email) or one that already exists in the system, found by their code.
 */
@Component({
  selector: "app-add-referee-dialog",
  templateUrl: "./add-referee-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppAvatarComponent,
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTabsModule,
    TranslocoPipe,
  ],
})
export class AddRefereeDialogComponent {
  private readonly api = inject(RefereesApi);
  private readonly dialogRef =
    inject<MatDialogRef<AddRefereeDialogComponent, AddRefereeResult>>(
      MatDialogRef,
    );
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly tab = signal(NEW_TAB);
  /** The user came from a duplicate email or phone: tell them how to get the code */
  readonly cameFromDuplicate = signal(false);

  // New referee

  private readonly newModel = signal<NewRefereeModel>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  readonly newForm = form(this.newModel, (referee) => {
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

  /** The backend says the email or the phone already belongs to someone */
  readonly duplicate = computed(() =>
    [this.newForm.email(), this.newForm.phone()].some((field) =>
      field.errors().some((error) => error.kind === "server"),
    ),
  );

  // Referee with a code

  private readonly codeModel = signal({ user_code: "" });

  readonly codeForm = form(this.codeModel, (code) => {
    required(code.user_code);
  });

  private readonly normalizedCode = computed(() =>
    this.codeModel().user_code.trim().toUpperCase(),
  );
  /** The code of the last search (empty until the first one) */
  private readonly searchedCode = signal("");

  readonly lookup = this.api.lookup(this.searchedCode);

  /** The result is only valid while the field still holds the searched code */
  private readonly current = computed(
    () =>
      this.searchedCode() !== "" &&
      this.searchedCode() === this.normalizedCode(),
  );
  readonly found = computed(() =>
    this.current() ? this.lookup.value() : undefined,
  );
  readonly searching = computed(
    () => this.current() && this.lookup.isLoading(),
  );

  /** `notFound` (404), `tooMany` (429) or `generic` for anything else */
  readonly lookupError = computed<"notFound" | "tooMany" | "generic" | null>(
    () => {
      const error = this.current() ? this.lookup.error() : undefined;

      if (!error) {
        return null;
      }

      const status = error instanceof HttpErrorResponse ? error.status : 0;

      return status === 404
        ? "notFound"
        : status === 429
          ? "tooMany"
          : "generic";
    },
  );

  errorText(errors: readonly ValidationError[], value: unknown): string {
    return refereeErrorText(this.transloco, errors, value);
  }

  goToCode(): void {
    this.cameFromDuplicate.set(true);
    this.tab.set(CODE_TAB);
  }

  saveNew(): Promise<boolean> {
    return this.formSubmit.submit(this.newForm, {
      errors: "form",
      send: () => {
        const { first_name, last_name, email, phone } = this.newModel();

        return this.api.create({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
        });
      },
      onSuccess: () => this.dialogRef.close("created"),
    });
  }

  search(): void {
    const field = this.codeForm.user_code();
    field.markAsTouched();

    const code = this.normalizedCode();

    if (!code) {
      return;
    }

    if (code === this.searchedCode()) {
      this.lookup.reload();
    } else {
      this.searchedCode.set(code);
    }
  }

  attach(): Promise<boolean> {
    return this.formSubmit.submit(this.codeForm, {
      errors: "form",
      send: () => this.api.attach(this.searchedCode()),
      onSuccess: () => this.dialogRef.close("attached"),
    });
  }
}
