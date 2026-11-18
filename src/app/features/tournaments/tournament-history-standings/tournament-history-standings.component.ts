import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatButtonModule } from "@angular/material/button";
import { ActivatedRoute } from "@angular/router";
import { TranslocoPipe } from "@jsverse/transloco";
import { map } from "rxjs";
import { StandingsApi } from "../../matches/standings.api";
import { StandingsViewComponent } from "../../matches/standings-view/standings-view.component";
import { TournamentsApi } from "../tournaments.api";

/** The standings of a finished tournament, read only: the same tables as Statistics, without the picker */
@Component({
  selector: "app-tournament-history-standings",
  templateUrl: "./tournament-history-standings.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, StandingsViewComponent, TranslocoPipe],
})
export class TournamentHistoryStandingsComponent {
  // The tournament's id is in the detail route: this tab is two levels below it
  protected readonly id = toSignal(
    inject(ActivatedRoute).parent!.parent!.paramMap.pipe(
      map((params) => Number(params.get("id")) || undefined),
    ),
    { initialValue: undefined },
  );

  private readonly tournament = inject(TournamentsApi).get(this.id);
  protected readonly name = computed(() =>
    this.tournament.hasValue() ? this.tournament.value().name : "",
  );

  protected readonly resource = inject(StandingsApi).standings(this.id);
  protected readonly groups = computed(() =>
    this.resource.hasValue() ? this.resource.value().groups : [],
  );
  protected readonly playoffs = computed(() =>
    this.resource.hasValue() ? (this.resource.value().playoffs ?? []) : [],
  );
  protected readonly hasRows = computed(() =>
    this.groups().some((group) => group.rows.length > 0),
  );
}
