import { DOCUMENT, inject, Service } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";

import { filter, take } from "rxjs/operators";

@Service()
export class AppSplashScreenService {
  private router = inject(Router);
  private document = inject<Document>(DOCUMENT);

  splashScreenElem?: HTMLElement;

  constructor() {
    this.splashScreenElem =
      this.document.body.querySelector("#app-splash-screen") ?? undefined;

    if (this.splashScreenElem) {
      this.router.events
        .pipe(
          filter((event) => event instanceof NavigationEnd),
          take(1),
        )
        .subscribe(() => this.hide());
    }
  }

  hide() {
    const elem = this.splashScreenElem;

    if (!elem) {
      return;
    }

    elem
      .animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 400,
        easing: "cubic-bezier(0.25, 0.8, 0.25, 1)",
        fill: "forwards",
      })
      .finished.then(() => elem.remove());
  }
}
