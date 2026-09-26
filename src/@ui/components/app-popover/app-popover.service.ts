import { ElementRef, Injector, inject, Service } from "@angular/core";
import {
  ConnectedPosition,
  ConnectionPositionPair,
  FlexibleConnectedPositionStrategyOrigin,
  Overlay,
  OverlayConfig,
  PositionStrategy,
} from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";
import { AppPopoverContent, AppPopoverRef } from "./app-popover-ref";
import { AppPopoverComponent } from "./app-popover.component";

export interface AppPopoverParams<T> {
  width?: string | number;
  height?: string | number;
  origin: ElementRef | HTMLElement;
  position?: ConnectionPositionPair[];
  content: AppPopoverContent;
  data?: T;
  offsetY?: number;
  offsetX?: number;
}

@Service()
export class AppPopoverService {
  private overlay = inject(Overlay);
  private injector = inject(Injector);

  open<T>({
    origin,
    content,
    data,
    width,
    height,
    position,
    offsetX,
    offsetY,
  }: AppPopoverParams<T>): AppPopoverRef<T> {
    const overlayRef = this.overlay.create(
      this.getOverlayConfig({
        origin,
        width,
        height,
        position,
        offsetX,
        offsetY,
      }),
    );
    const popoverRef = new AppPopoverRef<T>(overlayRef, content, data);

    const injector = this.createInjector(popoverRef, this.injector);
    overlayRef.attach(new ComponentPortal(AppPopoverComponent, null, injector));

    return popoverRef;
  }

  private static getPositions(): ConnectionPositionPair[] {
    return [
      {
        originX: "center",
        originY: "top",
        overlayX: "center",
        overlayY: "bottom",
      },
      {
        originX: "center",
        originY: "bottom",
        overlayX: "center",
        overlayY: "top",
      },
    ];
  }

  createInjector<T>(popoverRef: AppPopoverRef<T>, injector: Injector) {
    return Injector.create({
      providers: [
        {
          provide: AppPopoverRef,
          useValue: popoverRef,
        },
      ],
      parent: injector,
    });
  }

  private getOverlayConfig({
    origin,
    width,
    height,
    position,
    offsetX,
    offsetY,
  }: {
    origin: FlexibleConnectedPositionStrategyOrigin;
    width?: string | number;
    height?: string | number;
    position?: ConnectedPosition[];
    offsetX?: number;
    offsetY?: number;
  }): OverlayConfig {
    return new OverlayConfig({
      hasBackdrop: true,
      width,
      height,
      backdropClass: "app-popover-backdrop",
      positionStrategy: this.getOverlayPosition({
        origin,
        position,
        offsetX,
        offsetY,
      }),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });
  }

  private getOverlayPosition({
    origin,
    position,
    offsetX,
    offsetY,
  }: {
    origin: FlexibleConnectedPositionStrategyOrigin;
    position?: ConnectedPosition[];
    offsetX?: number;
    offsetY?: number;
  }): PositionStrategy {
    return this.overlay
      .position()
      .flexibleConnectedTo(origin)
      .withPositions(position || AppPopoverService.getPositions())
      .withFlexibleDimensions(true)
      .withDefaultOffsetY(offsetY || 0)
      .withDefaultOffsetX(offsetX || 0)
      .withTransformOriginOn(".app-popover")
      .withPush(true);
  }
}
