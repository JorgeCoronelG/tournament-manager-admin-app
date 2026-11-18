import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MatTabsModule } from "@angular/material/tabs";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { TranslocoPipe } from "@jsverse/transloco";
import { HISTORY_STATS_TABS } from "./history-stats-tabs";

/** The Statistics tab of a finished tournament: a row of inner tabs, each with its own route */
@Component({
  selector: "app-tournament-history-stats",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTabsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslocoPipe,
  ],
  template: `
    <nav [tabPanel]="panel" class="mb-4" mat-tab-nav-bar>
      @for (tab of tabs; track tab.path) {
        <a
          #active="routerLinkActive"
          [active]="active.isActive"
          [routerLink]="tab.path"
          mat-tab-link
          routerLinkActive
        >
          {{ tab.label | transloco }}
        </a>
      }
    </nav>

    <mat-tab-nav-panel #panel>
      <router-outlet />
    </mat-tab-nav-panel>
  `,
})
export class TournamentHistoryStatsComponent {
  protected readonly tabs = HISTORY_STATS_TABS;
}
