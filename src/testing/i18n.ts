import { EnvironmentProviders, importProvidersFrom } from "@angular/core";
import { TranslocoTestingModule } from "@jsverse/transloco";
import en from "../assets/i18n/en.json";

/** English translations, resolved synchronously, for tests */
export function provideTestI18n(): EnvironmentProviders {
  return importProvidersFrom(
    TranslocoTestingModule.forRoot({
      langs: { en },
      translocoConfig: { availableLangs: ["en"], defaultLang: "en" },
      preloadLangs: true,
    }),
  );
}
