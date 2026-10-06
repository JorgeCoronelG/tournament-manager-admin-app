import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { RouterLink } from "@angular/router";
import { TranslocoPipe } from "@jsverse/transloco";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { CurrentUserService } from "../../core/user/current-user.service";

/**
 * Wraps a league screen: shows its content once there is an active league and,
 * until then, tells the user what is missing (pick one, none assigned, or the
 * leagues did not load).
 *
 *   <app-league-required>...the screen...</app-league-required>
 */
@Component({
  selector: "app-league-required",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatProgressBarModule, RouterLink, TranslocoPipe],
  template: `
    @if (context.activeLeague()) {
      <ng-content />
    } @else if (context.isLoading() && context.leagues().length === 0) {
      <mat-progress-bar mode="indeterminate" />
    } @else if (context.error()) {
      <div class="py-10 px-6 text-center" role="alert">
        <p class="text-secondary mb-4">
          {{ "leagueSelector.error" | transloco }}
        </p>
        <button (click)="context.reload()" mat-stroked-button type="button">
          {{ "common.retry" | transloco }}
        </button>
      </div>
    } @else if (context.leagues().length === 0) {
      <p class="py-10 px-6 text-center text-secondary" role="status">
        @if (currentUser.can("leagues.manage")) {
          <a class="underline" routerLink="/dashboard/ligas">{{
            "leagueSelector.noneSuperadmin" | transloco
          }}</a>
        } @else {
          {{ "leagueSelector.noneAdmin" | transloco }}
        }
      </p>
    } @else {
      <p class="py-10 px-6 text-center text-secondary" role="status">
        {{ "leagueSelector.required" | transloco }}
      </p>
    }
  `,
})
export class LeagueRequiredComponent {
  protected readonly context = inject(LeagueContextService);
  protected readonly currentUser = inject(CurrentUserService);
}
