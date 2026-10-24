import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatTabsModule } from "@angular/material/tabs";
import { FieldTree, FormField, ValidationError } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppAvatarComponent } from "@ui/components/app-avatar/app-avatar.component";
import {
  ManagerMode,
  ManagerModel,
  managerErrorText,
  USER_CODE_MAX,
} from "../manager-form";
import { ManagerLookup } from "../team.model";
import { TeamsApi } from "../teams.api";

/**
 * The fields to give a team's delegate. With several `modes` they are tabs
 * (nobody yet / new delegate / existing one by code); with one, just its
 * fields. The chosen mode and the values live in the caller's form; `found` is
 * the delegate the code lookup found, which the caller needs to enable saving.
 */
@Component({
  selector: "app-manager-fields",
  templateUrl: "./manager-fields.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppAvatarComponent,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTabsModule,
    NgTemplateOutlet,
    TranslocoPipe,
  ],
})
export class ManagerFieldsComponent {
  private readonly api = inject(TeamsApi);
  private readonly transloco = inject(TranslocoService);

  readonly form = input.required<FieldTree<ManagerModel>>();
  readonly modes = input<readonly ManagerMode[]>(["none", "new", "code"]);

  /** The delegate the lookup found for the code in the field, if any */
  readonly found = model<ManagerLookup | undefined>(undefined);

  /** The user asked to search for the code in the field */
  readonly searched = output<void>();

  readonly userCodeMax = USER_CODE_MAX;

  protected readonly tabbed = computed(() => this.modes().length > 1);
  protected readonly tab = computed(() =>
    Math.max(0, this.modes().indexOf(this.form().mode().value())),
  );
  /** The user came from a duplicate email or phone: tell them how to get the code */
  protected readonly cameFromDuplicate = signal(false);

  /** The backend says the email or the phone already belongs to someone */
  protected readonly duplicate = computed(() =>
    [this.form().email(), this.form().phone()].some((field) =>
      field.errors().some((error) => error.kind === "server"),
    ),
  );

  private readonly resetDuplicateHint = effect(() => {
    if (!this.duplicate()) {
      this.cameFromDuplicate.set(false);
    }
  });

  private readonly duplicateNotice =
    viewChild<ElementRef<HTMLElement>>("duplicateNotice");

  /** The notice sits below the fields: bring it into view of the dialog's scroll */
  private readonly revealDuplicateNotice = effect(() => {
    this.duplicateNotice()?.nativeElement.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  });

  private readonly foundManager =
    viewChild<ElementRef<HTMLElement>>("foundManager");

  /** The delegate found sits below the field: bring it into view of the dialog's scroll (nothing happens without a result) */
  private readonly revealFoundManager = effect(() => {
    this.foundManager()?.nativeElement.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  });

  // Lookup of an existing delegate

  /** The code of the last search (empty until the first one) */
  private readonly searchedCode = signal("");
  private readonly normalizedCode = computed(() =>
    this.form().user_code().value().trim().toUpperCase(),
  );

  private readonly lookup = this.api.lookupManager(this.searchedCode);

  /** The result is only valid while the field still holds the searched code */
  private readonly current = computed(
    () =>
      this.searchedCode() !== "" &&
      this.searchedCode() === this.normalizedCode(),
  );

  protected readonly searching = computed(
    () => this.current() && this.lookup.isLoading(),
  );

  /** `notFound` (404), `tooMany` (429) or `generic` for anything else */
  protected readonly lookupError = computed<
    "notFound" | "tooMany" | "generic" | null
  >(() => {
    const error = this.current() ? this.lookup.error() : undefined;

    if (!error) {
      return null;
    }

    const status = error instanceof HttpErrorResponse ? error.status : 0;

    return status === 404 ? "notFound" : status === 429 ? "tooMany" : "generic";
  });

  private readonly publishFound = effect(() => {
    // `value()` throws while the resource is in error (e.g. a 404)
    this.found.set(
      this.current() && this.lookup.hasValue()
        ? this.lookup.value()
        : undefined,
    );
  });

  protected select(index: number): void {
    this.form()
      .mode()
      .value.set(this.modes()[index] ?? "new");
  }

  protected errorText(
    errors: readonly ValidationError[],
    value: unknown,
    max?: number,
  ): string {
    return managerErrorText(this.transloco, errors, value, max);
  }

  protected goToCode(): void {
    this.cameFromDuplicate.set(true);
    this.form().mode().value.set("code");
  }

  protected search(): void {
    this.searched.emit();
    this.form().user_code().markAsTouched();

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
}
