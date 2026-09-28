import { TranslocoPipe } from "@jsverse/transloco";
import {
  Component,
  inject,
  ChangeDetectionStrategy,
  computed,
} from "@angular/core";
import { AppLayoutService } from "@ui/services/app-layout.service";
import { AppConfigService } from "@ui/config/app-config.service";
import { AppColorScheme } from "@ui/config/app-config.interface";
import { NavigationService } from "../../../core/navigation/navigation.service";
import { AppPopoverService } from "@ui/components/app-popover/app-popover.service";
import { NavigationComponent } from "../navigation/navigation.component";
import { ToolbarUserComponent } from "./toolbar-user/toolbar-user.component";
import { NavigationItemComponent } from "../navigation/navigation-item/navigation-item.component";
import { RouterLink } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";
import { routeDataSignal } from "@ui/utils/route-data-signal";

@Component({
  selector: "app-toolbar",
  templateUrl: "./toolbar.component.html",
  styleUrls: ["./toolbar.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.shadow-b]": "showShadow()",
  },
  imports: [
    TranslocoPipe,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    RouterLink,
    NavigationItemComponent,
    ToolbarUserComponent,
    NavigationComponent,
  ],
})
export class ToolbarComponent {
  private readonly layoutService = inject(AppLayoutService);
  private readonly configService = inject(AppConfigService);
  private readonly navigationService = inject(NavigationService);
  private readonly popoverService = inject(AppPopoverService);

  readonly showShadow = routeDataSignal(
    (data) => data.toolbarShadowEnabled ?? false,
  );

  readonly navigationItems = this.navigationService.items;

  private readonly config = this.configService.config;
  readonly isHorizontalLayout = computed(
    () => this.config().layout === "horizontal",
  );
  readonly isVerticalLayout = computed(
    () => this.config().layout === "vertical",
  );
  readonly isNavbarInToolbar = computed(
    () => this.config().navbar.position === "in-toolbar",
  );
  readonly isNavbarBelowToolbar = computed(
    () => this.config().navbar.position === "below-toolbar",
  );
  readonly userVisible = computed(() => this.config().toolbar.user.visible);
  readonly title = computed(() => this.config().sidenav.title);

  readonly isDark = computed(
    () => this.config().style.colorScheme === AppColorScheme.DARK,
  );

  readonly isDesktop = this.layoutService.isDesktop;

  toggleDarkMode(): void {
    this.configService.updateConfig({
      style: {
        colorScheme: this.isDark() ? AppColorScheme.LIGHT : AppColorScheme.DARK,
      },
    });
  }

  openSidenav(): void {
    this.layoutService.openSidenav();
  }
}
