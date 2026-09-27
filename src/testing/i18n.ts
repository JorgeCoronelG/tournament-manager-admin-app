import { EnvironmentProviders, importProvidersFrom } from "@angular/core";
import { TranslocoTestingModule } from "@jsverse/transloco";
import es from "../assets/i18n/es.json";

/** Spanish translations, resolved synchronously, for tests */
export function provideTestI18n(): EnvironmentProviders {
  return importProvidersFrom(
    TranslocoTestingModule.forRoot({
      langs: { es },
      translocoConfig: { availableLangs: ["es"], defaultLang: "es" },
      preloadLangs: true,
    }),
  );
}
