import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { FormValueControl, ValidationError } from "@angular/forms/signals";
import {
  MatAutocomplete,
  MatAutocompleteModule,
} from "@angular/material/autocomplete";
import { MatButtonModule } from "@angular/material/button";
import { ErrorStateMatcher, MatOptionModule } from "@angular/material/core";
import {
  MatFormFieldModule,
  SubscriptSizing,
} from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInput, MatInputModule } from "@angular/material/input";
import { RouterLink } from "@angular/router";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { UserStatusChipComponent } from "../../users/user-status-chip/user-status-chip.component";
import { User } from "../../users/user.model";
import { UsersApi } from "../../users/users.api";
import { LeagueAdmin } from "../league.model";
import { LeaguesApi } from "../leagues.api";

/** How long the search waits after the last key before asking the API */
const SEARCH_DEBOUNCE = 300;

const fullName = (user: Pick<User, "first_name" | "last_name">): string =>
  `${user.first_name} ${user.last_name}`;

/**
 * Autocomplete that picks the user who manages a league. It searches users with
 * the `league_admin` role as the text changes and edits the manager's id
 * (`""` while none is chosen). Bind it with `[formField]`; pass `selected` so an
 * existing manager shows by name.
 */
@Component({
  selector: "app-league-admin-select",
  templateUrl: "./league-admin-select.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatOptionModule,
    RouterLink,
    TranslocoPipe,
    UserStatusChipComponent,
  ],
})
export class LeagueAdminSelectComponent implements FormValueControl<
  number | ""
> {
  private readonly destroyRef = inject(DestroyRef);
  private readonly leaguesApi = inject(LeaguesApi);
  private readonly transloco = inject(TranslocoService);
  private readonly usersApi = inject(UsersApi);

  readonly value = model<number | "">("");
  readonly label = input.required<string>();
  /** The current manager, to show their name before the user types anything */
  readonly selected = input<LeagueAdmin | null>(null);
  readonly subscriptSizing = input<SubscriptSizing>("fixed");
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly touched = input(false);
  readonly disabled = input(false);
  readonly touch = output<void>();

  /** What the input shows; the name of the chosen manager once there is one */
  readonly text = linkedSignal(() => {
    const admin = this.selected();

    return admin ? fullName(admin) : "";
  });
  /** What is being searched: `text` after the debounce */
  readonly search = signal("");

  readonly roles = this.usersApi.roles();
  private readonly roleId = computed(
    () => this.roles.value()?.find((role) => role.code === "league_admin")?.id,
  );
  readonly candidates = this.leaguesApi.adminCandidates(
    this.roleId,
    this.search,
  );
  readonly users = computed(() => this.candidates.value()?.data ?? []);

  /** The roles (or the manager role in them) did not load: nothing to search */
  readonly unavailable = computed(
    () =>
      !!this.roles.error() ||
      (this.roles.hasValue() && this.roleId() === undefined) ||
      !!this.candidates.error(),
  );
  readonly noResults = computed(
    () =>
      this.candidates.hasValue() &&
      !this.candidates.isLoading() &&
      this.users().length === 0,
  );

  readonly showError = computed(
    () => this.touched() && this.errors().length > 0,
  );
  /** `mat-error` only shows when the input is in error; there is no `NgControl` to ask */
  readonly matcher: ErrorStateMatcher = {
    isErrorState: () => this.showError(),
  };
  readonly errorText = computed(
    () =>
      this.errors().find((error) => error.message)?.message ??
      this.transloco.translate("validation.required"),
  );

  readonly displayUser = (user: User | string | null): string =>
    typeof user === "object" && user ? fullName(user) : "";

  private readonly input = viewChild(MatInput);
  private readonly autocomplete = viewChild(MatAutocomplete);

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Without an `NgControl` the input never re-reads the matcher by itself
    effect(() => {
      this.showError();
      this.input()?.updateErrorState();
    });

    this.destroyRef.onDestroy(() => clearTimeout(this.timer));
  }

  type(event: Event): void {
    const text = (event.target as HTMLInputElement).value;

    this.text.set(text);

    // Editing the text drops the choice: only picking an option sets a manager
    if (this.value() !== "") {
      this.value.set("");
    }

    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => this.search.set(text.trim()),
      SEARCH_DEBOUNCE,
    );
  }

  choose(user: User): void {
    clearTimeout(this.timer);
    this.text.set(fullName(user));
    this.search.set("");
    this.value.set(user.id);
  }

  clear(): void {
    clearTimeout(this.timer);
    this.text.set("");
    this.search.set("");
    this.value.set("");
    // The autocomplete remembers the picked option and would keep it checked
    this.autocomplete()?.options.forEach((option) => option.deselect());
    this.input()?.focus();
  }

  retry(): void {
    this.roles.reload();
    this.candidates.reload();
  }
}
