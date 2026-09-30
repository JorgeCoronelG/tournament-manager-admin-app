import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
} from "@angular/core";
import { AppLayoutService } from "@ui/services/app-layout.service";
import { RouterOutlet } from "@angular/router";
import { AppConfigService } from "@ui/config/app-config.service";
import { SidenavComponent } from "../components/sidenav/sidenav.component";
import { ToolbarComponent } from "../components/toolbar/toolbar.component";
import { FooterComponent } from "../components/footer/footer.component";
import { MatDialogModule } from "@angular/material/dialog";
import { BaseLayoutComponent } from "../base-layout/base-layout.component";
import { MatDrawerMode, MatSidenavModule } from "@angular/material/sidenav";
import { AppProgressBarComponent } from "@ui/components/app-progress-bar/app-progress-bar.component";
import { TranslocoPipe } from "@jsverse/transloco";

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
    MatDialogModule,
    MatSidenavModule,
    RouterOutlet,
    AppProgressBarComponent,
    TranslocoPipe,
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

  onSidenavClosed(): void {
    this.layoutService.closeSidenav();
  }
}
