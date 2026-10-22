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
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { RosterStatusChipComponent } from "../../rosters/roster-status-chip/roster-status-chip.component";
import { fullName, formatBirthDate } from "../player.model";
import { PlayersApi } from "../players.api";

export interface PlayerDetailDialogData {
  playerId: number;
}

/** The player with their rosters and bans in the active league (read only) */
@Component({
  selector: "app-player-detail-dialog",
  templateUrl: "./player-detail-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDateFormatRelativePipe,
    LogoImageComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressBarModule,
    RosterStatusChipComponent,
    TranslocoPipe,
  ],
})
export class PlayerDetailDialogComponent {
  private readonly data = inject<PlayerDetailDialogData>(MAT_DIALOG_DATA);

  protected readonly resource = inject(PlayersApi).detail(this.data.playerId);
  readonly player = computed(() =>
    this.resource.hasValue() ? this.resource.value() : undefined,
  );

  protected readonly fullName = fullName;
  protected readonly formatBirthDate = formatBirthDate;
}
