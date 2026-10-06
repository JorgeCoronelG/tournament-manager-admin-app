import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { RouterLink } from "@angular/router";
import { TranslocoPipe } from "@jsverse/transloco";
import { LeagueContextService } from "../../../../core/league-context/league-context.service";
import { CurrentUserService } from "../../../../core/user/current-user.service";

/** From this many leagues on, the list gets a search box */
const SEARCH_FROM = 8;

/**
 * Shows the active league in the toolbar and lets the user switch it. Renders
 * nothing for users without the `leagues.select` capability.
 */
@Component({
  selector: "app-league-selector",
  templateUrl: "./league-selector.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "block min-w-0" },
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterLink,
    TranslocoPipe,
  ],
})
export class LeagueSelectorComponent {
  private readonly currentUser = inject(CurrentUserService);
  private readonly context = inject(LeagueContextService);

  readonly leagues = this.context.leagues;
  readonly active = this.context.activeLeague;
  readonly isLoading = this.context.isLoading;
  readonly error = this.context.error;

  readonly visible = computed(() => this.currentUser.can("leagues.select"));
  /** The superadmin can create the league that is missing; a league admin cannot */
  readonly canManageLeagues = computed(() =>
    this.currentUser.can("leagues.manage"),
  );

  readonly query = signal("");
  readonly searchable = computed(() => this.leagues().length >= SEARCH_FROM);
  readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();

    return query
      ? this.leagues().filter((league) =>
          league.name.toLowerCase().includes(query),
        )
      : this.leagues();
  });

  select(id: number): void {
    this.context.select(id);
  }

  clear(): void {
    this.context.clear();
  }

  reload(): void {
    this.context.reload();
  }

  search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** The menu keeps its typeahead and arrow keys to itself unless told otherwise */
  keepKeys(event: Event): void {
    event.stopPropagation();
  }
}
