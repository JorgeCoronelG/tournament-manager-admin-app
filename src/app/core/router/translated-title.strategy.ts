import { inject, Injectable } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { RouterStateSnapshot, TitleStrategy } from "@angular/router";
import { TranslocoService } from "@jsverse/transloco";
import { AppConfigService } from "@ui/config/app-config.service";

/**
 * Route `title`s are translation keys: `title: "customers.title"` renders as
 * "Customers · <app name>" in the browser tab.
 */
@Injectable({ providedIn: "root" })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);
  private readonly config = inject(AppConfigService).config;

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot);
    const appName = this.config().sidenav.title;

    const pageTitle = key ? this.transloco.translate(key) : "";

    this.title.setTitle(
      pageTitle && pageTitle !== appName
        ? `${pageTitle} · ${appName}`
        : appName,
    );
  }
}
