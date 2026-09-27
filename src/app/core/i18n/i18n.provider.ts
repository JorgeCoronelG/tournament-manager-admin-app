import {
  EnvironmentProviders,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
} from "@angular/core";
import { provideTransloco } from "@jsverse/transloco";
import { LANG, LanguageService } from "./language.service";
import { TranslocoHttpLoader } from "./transloco-http.loader";

export function provideI18n(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        availableLangs: [LANG],
        defaultLang: LANG,
        fallbackLang: LANG,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => inject(LanguageService).init()),
  ]);
}
