import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { escapeHtml } from "../../../shared/confirm-dialog/confirm-dialog.service";

export interface FinishTournamentDialogData {
  tournamentName: string;
  /** The champion of each liguilla that already has one */
  champions: Array<{ liguilla: string; team: string }>;
}

/** Asks to finish the tournament, listing the champions it ends with. Closes with `true` when confirmed. */
@Component({
  selector: "app-finish-tournament-dialog",
  templateUrl: "./finish-tournament-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, TranslocoPipe],
})
export class FinishTournamentDialogComponent {
  protected readonly data = inject<FinishTournamentDialogData>(MAT_DIALOG_DATA);

  private readonly transloco = inject(TranslocoService);

  /** Name with HTML escaped: the texts bold it, so they are shown as HTML */
  private readonly name = escapeHtml(this.data.tournamentName);

  /** The generic message: its first paragraph is the question, the rest the warning */
  private readonly paragraphs = this.transloco
    .translate("matches.finish.message", { name: this.name })
    .split("\n\n");

  /** Asks to review the champions (one or several) or, with none, the plain question */
  protected readonly question = this.data.champions.length
    ? this.transloco.translate(
        this.data.champions.length === 1
          ? "matches.finish.reviewOne"
          : "matches.finish.reviewMany",
        { name: this.name },
      )
    : this.paragraphs[0];

  /** What finishing means: it goes after the champions */
  protected readonly warning = this.paragraphs.slice(1).join("\n\n");
}
