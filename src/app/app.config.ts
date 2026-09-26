import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from "@angular/core";
import { appRoutes } from "./app.routes";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
} from "@angular/router";
import { provideNativeDateAdapter } from "@angular/material/core";
import { provideIcons } from "./core/icons/icons.provider";
import { provideI18n } from "./core/i18n/i18n.provider";
import { AppErrorHandler } from "./core/http/app-error-handler";
import { errorInterceptor } from "./core/http/error.interceptor";
import { TranslatedTitleStrategy } from "./core/router/translated-title.strategy";
import { SettingsService } from "./core/settings/settings.service";
import { provideApp } from "@ui/app.provider";
import { provideNavigation } from "./core/navigation/navigation.provider";
import { appConfigs } from "@ui/config/app-configs";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideAppInitializer(() => inject(SettingsService).load()),
    provideNativeDateAdapter(),
    provideRouter(
      appRoutes,
      // TODO: Add preloading withPreloading(),
      withComponentInputBinding(),
      withInMemoryScrolling({
        anchorScrolling: "enabled",
        scrollPositionRestoration: "enabled",
      }),
    ),
    { provide: TitleStrategy, useExisting: TranslatedTitleStrategy },
    provideHttpClient(withInterceptors([errorInterceptor])),
    provideI18n(),

    provideApp({
      /**
       * The config that will be used by default.
       * This can be changed at runtime via the config panel or using the AppConfigService.
       */
      config: appConfigs.poseidon,
      /**
       * Only themes that are available in the config in tailwind.config.ts should be listed here.
       * Any theme not listed here will not be available in the config panel.
       */
      availableThemes: [
        {
          name: "Default",
          className: "app-theme-default",
        },
        {
          name: "Teal",
          className: "app-theme-teal",
        },
        {
          name: "Green",
          className: "app-theme-green",
        },
        {
          name: "Purple",
          className: "app-theme-purple",
        },
        {
          name: "Red",
          className: "app-theme-red",
        },
        {
          name: "Orange",
          className: "app-theme-orange",
        },
      ],
    }),
    provideNavigation(),
    provideIcons(),
  ],
};
