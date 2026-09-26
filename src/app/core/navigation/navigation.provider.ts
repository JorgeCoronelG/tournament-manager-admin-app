import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from "@angular/core";
import { NavigationService } from "./navigation.service";
import { NavigationLoaderService } from "./navigation-loader.service";

export function provideNavigation(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      inject(NavigationService);
    }),
    provideEnvironmentInitializer(() => {
      inject(NavigationLoaderService);
    }),
  ]);
}
