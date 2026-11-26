import { inject, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { BreakpointObserver } from "@angular/cdk/layout";
import { map } from "rxjs";
import { mediaDown } from "@ui/tailwind/breakpoints";

/** Phones: below the `sm` breakpoint. Call it in an injection context. */
export function injectIsMobile(): Signal<boolean> {
  return toSignal(
    inject(BreakpointObserver)
      .observe(mediaDown("sm"))
      .pipe(map((state) => state.matches)),
    { requireSync: true },
  );
}
