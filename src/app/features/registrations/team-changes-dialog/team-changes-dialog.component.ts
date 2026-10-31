import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { TranslocoPipe } from "@jsverse/transloco";
import { AppDateFormatRelativePipe } from "@ui/pipes/app-date-format-relative/app-date-format-relative.pipe";
import { Registration } from "../registration.model";
import { RegistrationsApi } from "../registrations.api";

export interface TeamChangesDialogData {
  tournamentId: number;
  registration: Registration;
}

/** Who held an enrollment before: each replacement with its reason, date and author (read only) */
@Component({
  selector: "app-team-changes-dialog",
  templateUrl: "./team-changes-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDateFormatRelativePipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressBarModule,
    TranslocoPipe,
  ],
})
export class TeamChangesDialogComponent {
  readonly data = inject<TeamChangesDialogData>(MAT_DIALOG_DATA);

  protected readonly resource = inject(RegistrationsApi).teamChanges(
    this.data.tournamentId,
    this.data.registration.id,
  );
  readonly changes = computed(() =>
    this.resource.hasValue() ? this.resource.value().data : [],
  );
}
