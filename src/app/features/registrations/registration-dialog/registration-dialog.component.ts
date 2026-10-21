import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatTooltipModule } from "@angular/material/tooltip";
import { debounce, form, FormField } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { failureMessage, fieldErrors } from "../../../core/http/api-errors";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { AvailableTeam, isBanned } from "../registration.model";
import { RegistrationsApi } from "../registrations.api";

export interface RegistrationDialogData {
  tournamentId: number;
}

/**
 * Picks the league's teams to enroll in a tournament. Teams can share a name,
 * so each option shows its delegate too; banned teams are listed but cannot be picked. Closes
 * with `true` once the backend accepted them; a refusal stays in the dialog.
 */
@Component({
  selector: "app-registration-dialog",
  templateUrl: "./registration-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    LogoImageComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
})
export class RegistrationDialogComponent {
  private readonly api = inject(RegistrationsApi);
  private readonly dialogRef =
    inject<MatDialogRef<RegistrationDialogComponent, boolean>>(MatDialogRef);
  private readonly transloco = inject(TranslocoService);
  private readonly data = inject<RegistrationDialogData>(MAT_DIALOG_DATA);

  readonly filters = signal({ search: "" });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  private readonly candidates = this.api.available(
    this.data.tournamentId,
    computed(() => this.filters().search),
  );

  readonly resource = this.candidates.resource;
  readonly teams = computed(() => this.candidates.rows() ?? []);

  /** Kept across searches, in the order they were picked */
  readonly selected = signal<readonly AvailableTeam[]>([]);
  readonly saving = signal(false);
  /** Which team the backend refused and why */
  readonly serverError = signal<string | null>(null);

  protected readonly isBanned = isBanned;

  isSelected(team: AvailableTeam): boolean {
    return this.selected().some((item) => item.id === team.id);
  }

  toggle(team: AvailableTeam, checked: boolean): void {
    if (isBanned(team)) {
      return;
    }

    this.serverError.set(null);
    this.selected.update((items) =>
      checked ? [...items, team] : items.filter((item) => item.id !== team.id),
    );
  }

  save(): void {
    const teams = this.selected();

    if (!teams.length || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.serverError.set(null);
    this.api
      .register(
        this.data.tournamentId,
        teams.map((team) => team.id),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (error: unknown) => {
          this.saving.set(false);
          this.serverError.set(this.describe(error, teams));
        },
      });
  }

  /** "Halcones (delegado: Ana Ruiz): Ya hay un equipo con ese nombre..." */
  private describe(error: unknown, teams: readonly AvailableTeam[]): string {
    const errors = fieldErrors(error);

    if (errors) {
      const lines = Object.entries(errors).flatMap(([field, messages]) => {
        const index = /^team_ids\.(\d+)$/.exec(field)?.[1];
        const team = index === undefined ? undefined : teams[Number(index)];

        return messages.map((message) =>
          team
            ? this.transloco.translate("registrations.dialog.failed", {
                team: this.label(team),
                message,
              })
            : message,
        );
      });

      return lines.join("\n");
    }

    return failureMessage(error, (key) => this.transloco.translate(key));
  }

  protected label(team: AvailableTeam): string {
    return team.manager
      ? this.transloco.translate("teams.withManager", {
          name: team.name,
          manager: team.manager.name,
        })
      : this.transloco.translate("teams.withoutManager", { name: team.name });
  }
}
