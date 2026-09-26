import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { AppDateFormatRelativePipe } from "@ui/pipes/app-date-format-relative/app-date-format-relative.pipe";
import { CustomerStatusChipComponent } from "./customer-status-chip.component";
import { CustomersApi } from "./customers.api";

@Component({
  selector: "app-customer-detail",
  templateUrl: "./customer-detail.component.html",
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
    MatProgressBarModule,
    RouterLink,
    TranslocoPipe,
  ],
})
export class CustomerDetailComponent {
  private readonly transloco = inject(TranslocoService);

  /** The `:id` route parameter (bound with `withComponentInputBinding`) */
  readonly id = input.required<string>();

  readonly customer = inject(CustomersApi).get(
    computed(() => {
      const id = Number(this.id());

      return Number.isInteger(id) ? id : undefined;
    }),
  );

  readonly crumbs = computed(() => [
    this.transloco.translate("nav.customers"),
    this.customer.hasValue() ? this.customer.value().name : `#${this.id()}`,
  ]);
}
