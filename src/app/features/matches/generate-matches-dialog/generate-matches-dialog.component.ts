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
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { form, FormField } from "@angular/forms/signals";
import { TranslocoPipe } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { GroupsApi } from "../../groups/groups.api";
import { GenerateResult, estimateGroup } from "../match.model";
import { MatchesApi } from "../matches.api";

export interface GenerateMatchesDialogData {
  tournamentId: number;
  /** 1 or 2 (double round-robin): the matchdays and matches depend on it */
  rounds: number;
  /** Replacing an existing calendar: asks for confirmation instead of just generating */
  regenerate: boolean;
}

/**
 * Generates the regular-phase calendar, or replaces it. Shows what each group
 * will get (estimated from its teams) and whether to draw the order of the
 * teams. Closes with the backend's result.
 */
@Component({
  selector: "app-generate-matches-dialog",
  templateUrl: "./generate-matches-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatIconModule,
    MatProgressBarModule,
    TranslocoPipe,
  ],
})
export class GenerateMatchesDialogComponent {
  private readonly api = inject(MatchesApi);
  private readonly dialogRef =
    inject<MatDialogRef<GenerateMatchesDialogComponent, GenerateResult>>(
      MatDialogRef,
    );
  private readonly formSubmit = inject(FormSubmitService);

  readonly data = inject<GenerateMatchesDialogData>(MAT_DIALOG_DATA);

  private readonly groupsResource = inject(GroupsApi).view(
    signal(this.data.tournamentId),
  );

  readonly summary = computed(() =>
    (this.groupsResource.value()?.regular ?? []).map((group) => ({
      name: group.name,
      teams: group.teams_count,
      ...estimateGroup(group.teams_count, this.data.rounds),
    })),
  );
  readonly loading = this.groupsResource.isLoading;

  /** The backend's refusal (not in progress, played matches, minimum matches...) */
  readonly formError = signal<string | null>(null);

  private readonly model = signal({ shuffle: true });
  readonly generateForm = form(this.model);

  save(): Promise<boolean> {
    this.formError.set(null);

    return this.formSubmit.submit(this.generateForm, {
      errors: "form",
      onFormError: (message) => this.formError.set(message),
      send: () =>
        this.api.generate(this.data.tournamentId, this.model().shuffle),
      onSuccess: (result) => this.dialogRef.close(result),
    });
  }
}
