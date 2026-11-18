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
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import {
  disabled,
  form,
  FormField,
  maxLength,
  required,
  validate,
  ValidationError,
} from "@angular/forms/signals";
import { catchError, throwError } from "rxjs";
import { fieldErrors } from "../../../core/http/api-errors";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { formUnchanged } from "../../../shared/form-unchanged/form-unchanged";
import { LeagueAdminSelectComponent } from "../league-admin-select/league-admin-select.component";
import { LeagueLimitsApi } from "../league-limits.api";
import { exceedsLimit, League } from "../league.model";
import { LeaguesApi } from "../leagues.api";

interface LeagueFormModel {
  name: string;
  /** `""` until a manager is chosen */
  admin_user_id: number | "";
  /** Ignored while "Sin límite" is on */
  max_active_tournaments: number | null;
  unlimited_tournaments: boolean;
}

const NAME_MAX = 150;

/** What a new league starts with; the field stays editable */
const DEFAULT_TOURNAMENTS = 1;

/** Creates a league, or edits the one passed as dialog data. Closes with the saved league. */
@Component({
  selector: "app-league-form-dialog",
  templateUrl: "./league-form-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    LeagueAdminSelectComponent,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
})
export class LeagueFormDialogComponent {
  private readonly api = inject(LeaguesApi);
  private readonly dialogRef =
    inject<MatDialogRef<LeagueFormDialogComponent, League>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly limitsApi = inject(LeagueLimitsApi);
  private readonly transloco = inject(TranslocoService);

  /** The league being edited; null when creating */
  readonly league = inject<League | null>(MAT_DIALOG_DATA, { optional: true });

  // A new league starts with one active tournament; an existing one shows what it has saved
  private readonly model = signal<LeagueFormModel>({
    name: this.league?.name ?? "",
    admin_user_id: this.league?.admin.id ?? "",
    max_active_tournaments: this.league
      ? this.league.max_active_tournaments
      : DEFAULT_TOURNAMENTS,
    unlimited_tournaments: this.league
      ? this.league.max_active_tournaments === null
      : false,
  });

  /**
   * The name/manager pair the server rejected as taken. The rule spans both
   * fields, so it is checked here (not as a field submission error) and clears
   * as soon as either one changes.
   */
  /** Editing with the same values as when it opened: Save stays disabled */
  private readonly sameValues = formUnchanged(this.model);
  readonly unchanged = computed(
    () => this.league !== null && this.sameValues(),
  );

  private readonly taken = signal<{
    name: string;
    adminId: number | "";
    message: string;
  } | null>(null);

  readonly leagueForm = form(this.model, (league) => {
    required(league.name);
    maxLength(league.name, NAME_MAX);
    validate(league.name, ({ value, valueOf }) => {
      const taken = this.taken();

      return taken &&
        taken.name === value().trim() &&
        taken.adminId === valueOf(league.admin_user_id)
        ? { kind: "server", message: taken.message }
        : undefined;
    });
    // The manager is picked from the list, never typed
    required(league.admin_user_id);

    // The limit is a valid number or "Sin límite"
    validate(league.max_active_tournaments, ({ value, valueOf }) => {
      const amount = value();

      return valueOf(league.unlimited_tournaments) ||
        (amount !== null && Number.isInteger(amount) && amount >= 1)
        ? undefined
        : { kind: "positiveInteger" };
    });
    disabled(league.max_active_tournaments, ({ valueOf }) =>
      valueOf(league.unlimited_tournaments),
    );
  });

  /** What the league uses today, to warn when the limits are set below it (editing only) */
  private readonly limits = this.limitsApi.ofLeague(
    computed(() => this.league?.id),
  );

  /** The new limit leaves the league over it: nothing is removed, but it cannot start more */
  readonly overLimits = computed(() => {
    const limits = this.limits.hasValue() ? this.limits.value() : undefined;
    const model = this.model();

    return (
      !!limits &&
      exceedsLimit(
        limits.usage,
        model.unlimited_tournaments ? null : model.max_active_tournaments,
      )
    );
  });

  /** The "Con límite" / "Sin límite" chips: the field is enabled only with a limit */
  setUnlimited(unlimited: boolean): void {
    this.leagueForm.unlimited_tournaments().value.set(unlimited);
  }

  /** Server messages win over the generic text of the failed rule */
  errorText(errors: readonly ValidationError[]): string {
    const message = errors.find((error) => error.message)?.message;

    if (message) {
      return message;
    }

    switch (errors[0]?.kind) {
      case "maxLength":
        return this.transloco.translate("validation.maxLength", {
          max: NAME_MAX,
        });
      case "positiveInteger":
        return this.transloco.translate("leagues.limits.positiveInteger");
      default:
        return this.transloco.translate("validation.required");
    }
  }

  save(): Promise<boolean> {
    return this.formSubmit.submit(this.leagueForm, {
      errors: "form",
      ignoreFields: ["name"],
      send: () => {
        const model = this.model();
        const body = {
          name: model.name.trim(),
          admin_user_id: Number(model.admin_user_id),
          // "Sin límite" goes as null
          max_active_tournaments: model.unlimited_tournaments
            ? null
            : model.max_active_tournaments,
        };

        const request = this.league
          ? this.api.update(this.league.id, body)
          : this.api.create(body);

        return request.pipe(
          catchError((error: unknown) => {
            const message = fieldErrors(error)?.["name"]?.join(" ");

            if (message) {
              this.taken.set({
                name: body.name,
                adminId: body.admin_user_id,
                message,
              });
            }

            return throwError(() => error);
          }),
        );
      },
      onSuccess: (saved) => this.dialogRef.close(saved),
    });
  }
}
