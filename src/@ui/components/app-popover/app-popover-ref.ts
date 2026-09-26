import { OverlayRef } from "@angular/cdk/overlay";
import { Subject } from "rxjs";
import { TemplateRef, Type } from "@angular/core";

export interface AppPopoverCloseEvent<T = unknown> {
  type: "backdropClick" | "close";
  data: T | undefined;
}

export type AppPopoverContent = TemplateRef<unknown> | Type<unknown> | string;

export class AppPopoverRef<T = unknown> {
  private afterClosed = new Subject<AppPopoverCloseEvent<T>>();
  afterClosed$ = this.afterClosed.asObservable();

  constructor(
    public overlay: OverlayRef,
    public content: AppPopoverContent,
    public data: T | undefined,
  ) {
    overlay.backdropClick().subscribe(() => {
      this._close("backdropClick", undefined);
    });
  }

  close(data?: T) {
    this._close("close", data);
  }

  private _close(type: AppPopoverCloseEvent["type"], data?: T) {
    this.overlay.dispose();
    this.afterClosed.next({
      type,
      data,
    });
    this.afterClosed.complete();
  }
}
