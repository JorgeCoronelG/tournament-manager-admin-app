import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { ActivatedRoute } from "@angular/router";
import { TranslocoPipe } from "@jsverse/transloco";
import { map } from "rxjs";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { TournamentsApi } from "../tournaments.api";

/** The numbers and the champions of a finished tournament, as the backend sums them up */
@Component({
  selector: "app-tournament-history-summary",
  templateUrl: "./tournament-history-summary.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    LogoImageComponent,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
  ],
})
export class TournamentHistorySummaryComponent {
  // The tournament's id is in the detail route that holds this tab
  private readonly id = toSignal(
    inject(ActivatedRoute).parent!.paramMap.pipe(
      map((params) => Number(params.get("id")) || undefined),
    ),
    { initialValue: undefined },
  );

  protected readonly resource = inject(TournamentsApi).summary(this.id);
  protected readonly summary = computed(() =>
    this.resource.hasValue() ? this.resource.value() : undefined,
  );

  protected readonly cards = computed(() => {
    const summary = this.summary();

    return summary
      ? [
          { key: "teams", icon: "mat:groups", value: summary.teams_count },
          {
            key: "playoffs",
            icon: "mat:emoji_events",
            value: summary.playoffs_count,
          },
          {
            key: "matches",
            icon: "mat:calendar_month",
            value: summary.matches_played,
          },
          {
            key: "goals",
            icon: "mat:sports_soccer",
            value: summary.goals_scored,
          },
        ]
      : [];
  });

  /** "1-4" is shown as "1–4"; texts like "Mejor 4.o" stay as they are */
  protected positions(text: string): string {
    return text.replace(/(\d)-(\d)/g, "$1–$2");
  }
}
