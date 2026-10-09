import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from "@angular/core";
import { appRoutes } from "./app.routes";
import {
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
} from "@angular/common/http";
import { provideLoadingBarInterceptor } from "@ngx-loading-bar/http-client";
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
} from "@angular/router";
import {
  MAT_DATE_LOCALE,
  MatDateFormats,
  provideNativeDateAdapter,
} from "@angular/material/core";
import { MatDatepickerIntl } from "@angular/material/datepicker";
import { MatPaginatorIntl } from "@angular/material/paginator";
import { provideIcons } from "./core/icons/icons.provider";
import { AppDatepickerIntl } from "./core/i18n/app-datepicker-intl";
import { AppPaginatorIntl } from "./core/i18n/app-paginator-intl";
import { provideI18n } from "./core/i18n/i18n.provider";
import { AppErrorHandler } from "./core/http/app-error-handler";
import { authTokenInterceptor } from "./core/http/auth-token.interceptor";
import { errorInterceptor } from "./core/http/error.interceptor";
import { leagueContextInterceptor } from "./core/league-context/league-context.interceptor";
import { TranslatedTitleStrategy } from "./core/router/translated-title.strategy";
import { SettingsService } from "./core/settings/settings.service";
import { provideApp } from "@ui/app.provider";
import { provideNavigation } from "./core/navigation/navigation.provider";
import { appConfigs } from "@ui/config/app-configs";

/** Same as the native adapter's defaults, but the input shows two-digit day and month (dd/mm/yyyy) */
const APP_DATE_FORMATS: MatDateFormats = {
  parse: { dateInput: null },
  display: {
    dateInput: { day: "2-digit", month: "2-digit", year: "numeric" },
    monthYearLabel: { year: "numeric", month: "short" },
    dateA11yLabel: { year: "numeric", month: "long", day: "numeric" },
    monthYearA11yLabel: { year: "numeric", month: "long" },
  },
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideAppInitializer(() => inject(SettingsService).load()),
    provideNativeDateAdapter(APP_DATE_FORMATS),
    { provide: MAT_DATE_LOCALE, useValue: "es-MX" },
    { provide: MatDatepickerIntl, useClass: AppDatepickerIntl },
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
    { provide: MatPaginatorIntl, useClass: AppPaginatorIntl },
    provideHttpClient(
      withInterceptors([
        authTokenInterceptor,
        leagueContextInterceptor,
        errorInterceptor,
      ]),
      withInterceptorsFromDi(),
    ),
    provideLoadingBarInterceptor(),
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
