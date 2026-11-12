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
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
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
  /** Regenerating: the regular phase's matches with an assigned time, fixed by hand and with a referee */
  assignments?: { scheduled: number; locked: number; referees: number };
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

  private readonly transloco = inject(TranslocoService);

  readonly data = inject<GenerateMatchesDialogData>(MAT_DIALOG_DATA);

  /** "Se perderán 12 horarios asignados (3 fijados) y 8 árbitros asignados."; null when nothing is lost */
  readonly lostText = computed(() => {
    const {
      scheduled = 0,
      locked = 0,
      referees = 0,
    } = this.data.assignments ?? {};
    const t = (base: string, count: number) =>
      this.transloco.translate(`${base}${count === 1 ? "One" : "Many"}`, {
        count,
      });
    const parts: string[] = [];

    if (scheduled > 0) {
      parts.push(
        t("matches.regenerate.lostSchedules", scheduled) +
          (locked > 0 ? ` ${t("matches.regenerate.lostLocked", locked)}` : ""),
      );
    }

    if (referees > 0) {
      parts.push(t("matches.regenerate.lostReferees", referees));
    }

    return parts.length
      ? this.transloco.translate("matches.regenerate.lost", {
          what: parts.join(
            ` ${this.transloco.translate("matches.regenerate.and")} `,
          ),
        })
      : null;
  });

  private readonly groupsResource = inject(GroupsApi).view(
    signal(this.data.tournamentId),
  );

  readonly summary = computed(() =>
    (this.groupsResource.value()?.regular ?? []).map((group) => ({
      name: group.name,
      teams: group.teams_count,
      /** With an odd number of teams one rests each matchday */
      resting: group.teams_count % 2,
      ...estimateGroup(group.teams_count, this.data.rounds),
    })),
  );
  /** Some group has an odd number of teams: they take turns to rest */
  readonly hasResting = computed(() =>
    this.summary().some((group) => group.resting > 0),
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
