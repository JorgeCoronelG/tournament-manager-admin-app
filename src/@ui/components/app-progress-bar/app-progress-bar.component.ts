import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  LOADING_BAR_CONFIG,
  LoadingBarConfig,
  LoadingBarModule,
  LoadingBarService,
} from "@ngx-loading-bar/core";
import { delayWhen, interval, of } from "rxjs";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { LoadingBarRouterModule } from "@ngx-loading-bar/router";

@Component({
  selector: "app-progress-bar",
  templateUrl: "./app-progress-bar.component.html",
  styleUrls: ["./app-progress-bar.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressBarModule, LoadingBarModule, LoadingBarRouterModule],
  providers: [
    {
      provide: LOADING_BAR_CONFIG,
      useValue: {
        latencyThreshold: 80,
      } as LoadingBarConfig,
    },
  ],
})
export class AppProgressBarComponent {
  loader = inject(LoadingBarService);

  readonly value = toSignal(
    this.loader
      .useRef("router")
      .value$.pipe(
        delayWhen((value) => (value === 0 ? interval(200) : of(undefined))),
      ),
    { initialValue: 0 },
  );

  readonly visible = computed(() => this.value() > 0 && this.value() !== 100);
}
