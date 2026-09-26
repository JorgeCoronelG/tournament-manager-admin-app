import {
  EnvironmentProviders,
  inject,
  provideEnvironmentInitializer,
} from "@angular/core";
import { IconsService } from "./icons.service";

export function provideIcons(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    inject(IconsService);
  });
}
