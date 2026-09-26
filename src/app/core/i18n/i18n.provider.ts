import {
  EnvironmentProviders,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
} from "@angular/core";
import { provideTransloco } from "@jsverse/transloco";
import { LanguageService, LANGUAGES } from "./language.service";
import { TranslocoHttpLoader } from "./transloco-http.loader";

export function provideI18n(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        availableLangs: LANGUAGES.map((language) => language.code),
        defaultLang: "en",
        fallbackLang: "en",
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => inject(LanguageService).init()),
  ]);
}
