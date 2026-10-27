import { DatePipe } from "@angular/common";
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
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatRadioModule } from "@angular/material/radio";
import { Observable } from "rxjs";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { parseDate } from "../../tournaments/tournament.model";
import { ScheduleApi } from "../schedule.api";
import {
  ScheduleMode,
  SchedulePreview,
  ScheduleScope,
  slotLabel,
} from "../schedule.model";

export interface AssignScheduleDialogData {
  tournamentId: number;
}

/**
 * Assigns day, hour and field to the matches: the mode and scope are chosen,
 * the preview shows what would happen and only then can it be assigned. Closes
 * with `true` once assigned.
 */
@Component({
  selector: "app-assign-schedule-dialog",
  templateUrl: "./assign-schedule-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressBarModule,
    MatRadioModule,
    TranslocoPipe,
  ],
})
export class AssignScheduleDialogComponent {
  private readonly api = inject(ScheduleApi);
  private readonly dialogRef =
    inject<MatDialogRef<AssignScheduleDialogComponent, boolean>>(MatDialogRef);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<AssignScheduleDialogData>(MAT_DIALOG_DATA);

  readonly mode = signal<ScheduleMode>("balanced");
  readonly scope = signal<ScheduleScope>("all");

  /** Only valid for the mode and scope it was asked with: changing them drops it */
  readonly preview = signal<SchedulePreview | undefined>(undefined);
  readonly working = signal(false);
  readonly error = signal<string | null>(null);

  readonly parseDate = parseDate;

  setMode(mode: ScheduleMode): void {
    this.mode.set(mode);
    this.preview.set(undefined);
  }

  setScope(scope: ScheduleScope): void {
    this.scope.set(scope);
    this.preview.set(undefined);
  }

  slot(iso: string, field: string | null | undefined): string {
    return slotLabel(iso, field, (weekday) =>
      this.transloco.translate(`matches.config.weekdays.${weekday}`),
    );
  }

  calculate(): void {
    this.run(
      this.api.preview(this.data.tournamentId, this.options()),
      (result) => this.preview.set(result),
    );
  }

  assign(): void {
    if (!this.preview()) {
      return;
    }

    this.run(
      this.api.generate(this.data.tournamentId, this.generateOptions()),
      () => this.dialogRef.close(true),
    );
  }

  private options() {
    return { mode: this.mode(), scope: this.scope() };
  }

  /** Generating repeats the preview's draw, so the result is what was shown */
  private generateOptions() {
    return { ...this.options(), seed: this.preview()?.seed ?? null };
  }

  private run<T>(request: Observable<T>, onSuccess: (result: T) => void): void {
    if (this.working()) {
      return;
    }

    this.working.set(true);
    this.error.set(null);
    request.subscribe({
      next: (result) => {
        this.working.set(false);
        onSuccess(result);
      },
      error: (error: unknown) => {
        this.working.set(false);
        this.error.set(this.snackbar.failureText(error));
      },
    });
  }
}
