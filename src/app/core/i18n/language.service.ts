import { DOCUMENT, inject, Service, signal } from "@angular/core";
import { TranslocoService } from "@jsverse/transloco";
import { Settings } from "luxon";
import { firstValueFrom } from "rxjs";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const STORAGE_KEY = "app.lang";

function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value);
}

function storedLanguage(): LanguageCode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLanguageCode(value) ? value : null;
  } catch {
    return null;
  }
}

/** The stored choice, then the browser language, then English */
function initialLanguage(): LanguageCode {
  const browser = navigator.language?.slice(0, 2);

  return storedLanguage() ?? (isLanguageCode(browser) ? browser : "en");
}

@Service()
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject<Document>(DOCUMENT);

  readonly languages = LANGUAGES;
  private readonly _current = signal<LanguageCode>("en");
  readonly current = this._current.asReadonly();

  /** Called once before the app starts, so no translation key ever flashes */
  init(): Promise<void> {
    return this.use(initialLanguage(), false);
  }

  async use(code: LanguageCode, persist = true): Promise<void> {
    await firstValueFrom(this.transloco.load(code));

    this.transloco.setActiveLang(code);
    this._current.set(code);
    this.document.documentElement.lang = code;
    Settings.defaultLocale = code;

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {
        // Not persisted; the choice still applies to this session
      }
    }
  }
}
