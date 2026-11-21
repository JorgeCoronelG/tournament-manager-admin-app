import { inject, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { BreakpointObserver } from "@angular/cdk/layout";
import { map } from "rxjs";

/** Phones: below 600px (`Breakpoints.XSmall`). Call it in an injection context. */
export function injectIsMobile(): Signal<boolean> {
  return toSignal(
    inject(BreakpointObserver)
      .observe("(max-width: 599.98px)")
      .pipe(map((state) => state.matches)),
    { requireSync: true },
  );
}
