import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
} from "@angular/core";
import { AppLayoutService } from "@ui/services/app-layout.service";
import { RouterOutlet } from "@angular/router";
import { AppConfigService } from "@ui/config/app-config.service";
import { AppSidebarComponent } from "@ui/components/app-sidebar/app-sidebar.component";

import { SidenavComponent } from "../components/sidenav/sidenav.component";
import { ToolbarComponent } from "../components/toolbar/toolbar.component";
import { FooterComponent } from "../components/footer/footer.component";
import { ConfigPanelToggleComponent } from "../components/config-panel/config-panel-toggle/config-panel-toggle.component";
import { ConfigPanelComponent } from "../components/config-panel/config-panel.component";
import { MatDialogModule } from "@angular/material/dialog";
import { BaseLayoutComponent } from "../base-layout/base-layout.component";
import { MatDrawerMode, MatSidenavModule } from "@angular/material/sidenav";
import { SearchComponent } from "../components/toolbar/search/search.component";
import { AppProgressBarComponent } from "@ui/components/app-progress-bar/app-progress-bar.component";

@Component({
  selector: "app-layout",
  templateUrl: "./layout.component.html",
  styleUrls: ["./layout.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BaseLayoutComponent,
    SidenavComponent,
    ToolbarComponent,
    FooterComponent,
    ConfigPanelToggleComponent,
    AppSidebarComponent,
    ConfigPanelComponent,
    MatDialogModule,
    MatSidenavModule,
    RouterOutlet,
    SearchComponent,
    AppProgressBarComponent,
  ],
})
export class LayoutComponent {
  private readonly layoutService = inject(AppLayoutService);
  private readonly configService = inject(AppConfigService);

  readonly config = this.configService.config;
  readonly sidenavCollapsed = this.layoutService.sidenavCollapsed;
  readonly sidenavDisableClose = this.layoutService.isDesktop;
  readonly sidenavFixedInViewport = computed(
    () => !this.layoutService.isDesktop(),
  );
  readonly sidenavMode = computed<MatDrawerMode>(() =>
    !this.layoutService.isDesktop() || this.config().layout === "vertical"
      ? "over"
      : "side",
  );
  readonly sidenavOpen = this.layoutService.sidenavOpen;
  readonly configPanelOpen = this.layoutService.configPanelOpen;

  onSidenavClosed(): void {
    this.layoutService.closeSidenav();
  }

  onConfigPanelChange(opened: boolean): void {
    if (opened) {
      this.layoutService.openConfigpanel();
    } else {
      this.layoutService.closeConfigpanel();
    }
  }
}
