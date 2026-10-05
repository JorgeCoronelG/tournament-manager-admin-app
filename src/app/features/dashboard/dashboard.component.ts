import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";

@Component({
  selector: "app-dashboard",
  templateUrl: "./dashboard.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppBreadcrumbsComponent,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    MatIconModule,
    TranslocoPipe,
  ],
})
export class DashboardComponent {
  private readonly transloco = inject(TranslocoService);

  // Fixed values for reference only: replace them with real data once the API provides it
  readonly stats = [
    { key: "tournaments", icon: "mat:emoji_events", count: 4 },
    { key: "matches", icon: "mat:sports_soccer", count: 60 },
    { key: "players", icon: "mat:groups", count: 230 },
  ];

  readonly crumbs = computed(() => [this.transloco.translate("nav.dashboard")]);
}
