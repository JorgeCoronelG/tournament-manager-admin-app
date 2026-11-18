import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TranslocoPipe } from "@jsverse/transloco";

/** A section of the history's detail whose content is still to come */
@Component({
  selector: "app-tournament-history-tab",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <p
      class="bg-foreground rounded shadow m-0 py-10 px-6 text-center text-secondary"
    >
      {{ "tournaments.history.detail.soon" | transloco }}
    </p>
  `,
})
export class TournamentHistoryTabComponent {}
