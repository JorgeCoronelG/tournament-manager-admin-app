import { TranslocoPipe } from "@jsverse/transloco";
import {
  Component,
  inject,
  ChangeDetectionStrategy,
  computed,
} from "@angular/core";
import { AppLayoutService } from "@ui/services/app-layout.service";
import { AppConfigService } from "@ui/config/app-config.service";
import { NavigationService } from "../../../core/navigation/navigation.service";
import { AppPopoverService } from "@ui/components/app-popover/app-popover.service";
import { NavigationComponent } from "../navigation/navigation.component";
import { ToolbarUserComponent } from "./toolbar-user/toolbar-user.component";
import { ToolbarNotificationsComponent } from "./toolbar-notifications/toolbar-notifications.component";
import { NavigationItemComponent } from "../navigation/navigation-item/navigation-item.component";
import { MatMenuModule } from "@angular/material/menu";
import { RouterLink } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import {
  LanguageCode,
  LanguageService,
} from "../../../core/i18n/language.service";
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
    RouterLink,
    MatMenuModule,
    NavigationItemComponent,
    ToolbarNotificationsComponent,
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

  private readonly languageService = inject(LanguageService);
  readonly languages = this.languageService.languages;
  readonly currentLanguage = this.languageService.current;

  readonly isDesktop = this.layoutService.isDesktop;

  openSidenav(): void {
    this.layoutService.openSidenav();
  }

  setLanguage(code: LanguageCode): void {
    void this.languageService.use(code);
  }

  openSearch(): void {
    this.layoutService.openSearch();
  }
}
