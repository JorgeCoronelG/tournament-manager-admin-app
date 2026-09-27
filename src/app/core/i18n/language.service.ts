import { DOCUMENT, inject, Service } from "@angular/core";
import { TranslocoService } from "@jsverse/transloco";
import { Settings } from "luxon";
import { firstValueFrom } from "rxjs";

/** The only language the app ships. Kept as a constant so there is a single place to add more later. */
export const LANG = "es";

/** Wires Transloco, `<html lang>` and Luxon's locale to the app's language, once at startup */
@Service()
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject<Document>(DOCUMENT);

  /** Called once before the app starts, so no translation key ever flashes */
  async init(): Promise<void> {
    await firstValueFrom(this.transloco.load(LANG));

    this.transloco.setActiveLang(LANG);
    this.document.documentElement.lang = LANG;
    Settings.defaultLocale = LANG;
  }
}
