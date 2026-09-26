import { InjectionToken } from "@angular/core";
import { AppConfig, AppThemeProvider } from "@ui/config/app-config.interface";

export const APP_CONFIG = new InjectionToken<AppConfig>("APP_CONFIG");
export const APP_THEMES = new InjectionToken<AppThemeProvider[]>("APP_THEMES");
