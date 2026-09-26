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
