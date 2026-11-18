import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatButtonModule } from "@angular/material/button";
import { MatTabsModule } from "@angular/material/tabs";
import { ActivatedRoute, RouterLink, RouterLinkActive } from "@angular/router";
import { TranslocoPipe } from "@jsverse/transloco";
import { map } from "rxjs";
import { BracketViewComponent } from "../../matches/bracket-view/bracket-view.component";
import { PlayoffsApi } from "../../matches/playoffs.api";

/**
 * The Playoffs tab of a finished tournament: the bracket of its playoff, read only.
 * With several, a tab each (its id in the route, so the link can be shared).
 */
@Component({
  selector: "app-tournament-history-playoffs",
  templateUrl: "./tournament-history-playoffs.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BracketViewComponent,
    MatButtonModule,
    MatTabsModule,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
  ],
})
export class TournamentHistoryPlayoffsComponent {
  private readonly route = inject(ActivatedRoute);

  // The tournament's id is in the detail route that holds this tab
  protected readonly tournamentId = toSignal(
    this.route.parent!.paramMap.pipe(
      map((params) => Number(params.get("id")) || undefined),
    ),
    { initialValue: undefined },
  );

  /** The playoff the link asks for; the first one when it names none */
  private readonly playoffId = toSignal(
    this.route.paramMap.pipe(
      map((params) => Number(params.get("playoffId")) || undefined),
    ),
    { initialValue: undefined },
  );

  protected readonly resource = inject(PlayoffsApi).bracket(this.tournamentId);

  protected readonly playoffs = computed(() =>
    this.resource.hasValue() ? this.resource.value().playoffs : [],
  );

  protected readonly selected = computed(
    () =>
      this.playoffs().find((item) => item.group_id === this.playoffId()) ??
      this.playoffs()[0],
  );
}
