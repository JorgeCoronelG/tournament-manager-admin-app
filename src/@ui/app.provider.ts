import {
  EnvironmentProviders,
  inject,
  provideEnvironmentInitializer,
  Provider,
} from "@angular/core";
import {
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
  MatFormFieldDefaultOptions,
} from "@angular/material/form-field";
import {
  MAT_TOOLTIP_DEFAULT_OPTIONS,
  MatTooltipDefaultOptions,
} from "@angular/material/tooltip";
import { AppSplashScreenService } from "@ui/services/app-splash-screen.service";
import { AppLayoutService } from "@ui/services/app-layout.service";
import { AppPlatformService } from "@ui/services/app-platform.service";
import { AppConfig, AppThemeProvider } from "@ui/config/app-config.interface";
import { APP_CONFIG, APP_THEMES } from "@ui/config/config.token";

export function provideApp(options: {
  config: AppConfig;
  availableThemes: AppThemeProvider[];
}): Array<Provider | EnvironmentProviders> {
  return [
    {
      provide: APP_CONFIG,
      useValue: options.config,
    },
    {
      provide: APP_THEMES,
      useValue: options.availableThemes,
    },
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        appearance: "outline",
      } satisfies MatFormFieldDefaultOptions,
    },
    {
      // Tooltips go above their element across the whole app
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: {
        position: "above",
        showDelay: 0,
        hideDelay: 0,
        touchendHideDelay: 1500,
      } satisfies MatTooltipDefaultOptions,
    },
    provideEnvironmentInitializer(() => {
      inject(AppSplashScreenService);
    }),
    provideEnvironmentInitializer(() => {
      inject(AppLayoutService);
    }),
    provideEnvironmentInitializer(() => {
      inject(AppPlatformService);
    }),
  ];
}
