import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
} from "@angular/core";
import { httpResource } from "@angular/common/http";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { AppDateFormatRelativePipe } from "@ui/pipes/app-date-format-relative/app-date-format-relative.pipe";
import { SettingsService } from "../../core/settings/settings.service";
import { CustomerStatusChipComponent } from "../customers/customer-status-chip.component";
import { Customer } from "../customers/customer.model";
import { CustomersApi } from "../customers/customers.api";

@Component({
  selector: "app-dashboard",
  templateUrl: "./dashboard.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppBreadcrumbsComponent,
    AppDateFormatRelativePipe,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    CustomerStatusChipComponent,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    TranslocoPipe,
  ],
})
export class DashboardComponent {
  private readonly api = inject(CustomersApi);
  private readonly settings = inject(SettingsService);
  private readonly transloco = inject(TranslocoService);

  readonly stats = [
    { key: "total", icon: "mat:people", count: this.api.count() },
    {
      key: "active",
      icon: "mat:check_circle",
      count: this.api.count("active"),
    },
    {
      key: "inactive",
      icon: "mat:pause_circle",
      count: this.api.count("inactive"),
    },
  ];

  private readonly recentResource = httpResource<Customer[]>(() => ({
    url: this.settings.api("/customers"),
    params: { _limit: 5, _sort: "createdAt", _order: "desc" },
  }));

  readonly recent = linkedSignal<Customer[] | undefined, Customer[]>({
    source: this.recentResource.value,
    computation: (value, previous) => value ?? previous?.value ?? [],
  });

  readonly crumbs = computed(() => [this.transloco.translate("nav.dashboard")]);
}
