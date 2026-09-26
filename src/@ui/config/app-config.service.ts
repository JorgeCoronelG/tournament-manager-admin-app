import { DOCUMENT, effect, inject, Service, signal } from "@angular/core";

import { DeepPartial } from "../interfaces/deep-partial.type";
import { mergeDeep } from "../utils/merge-deep";
import { AppLayoutService } from "../services/app-layout.service";
import { appConfigs } from "./app-configs";
import {
  AppColorScheme,
  AppConfig,
  AppConfigName,
  AppConfigs,
} from "./app-config.interface";
import { CSSValue } from "../interfaces/css-value.type";
import { APP_CONFIG, APP_THEMES } from "@ui/config/config.token";
import {
  applyPreferences,
  readPreferences,
  toPreferences,
  writePreferences,
} from "./app-config-storage";

@Service()
export class AppConfigService {
  private readonly initialConfig = inject<AppConfig>(APP_CONFIG);
  private readonly themes = inject(APP_THEMES);
  private readonly document = inject<Document>(DOCUMENT);
  private readonly layoutService = inject(AppLayoutService);

  readonly configMap: AppConfigs = appConfigs;
  readonly configs: AppConfig[] = Object.values(this.configMap);
  private readonly _config = signal<AppConfig>(this.restoreConfig());
  readonly config = this._config.asReadonly();

  constructor() {
    effect(() => {
      const config = this._config();

      this._updateConfig(config);
      writePreferences(toPreferences(config));
    });
  }

  /**
   * Restores the preferences the user saved from the config panel, on top of
   * the layout they were using.
   */
  private restoreConfig(): AppConfig {
    const preferences = readPreferences(this.themes.map((t) => t.className));

    if (!preferences) {
      return this.initialConfig;
    }

    const base = this.configMap[preferences.id] ?? this.initialConfig;

    return applyPreferences(base, preferences);
  }

  setConfig(configName: AppConfigName) {
    const settings = this.configMap[configName];

    if (!settings) {
      throw new Error(`Config with name '${configName}' does not exist!`);
    }

    this._config.set(settings);
  }

  updateConfig(config: DeepPartial<AppConfig>) {
    this._config.update((current) => mergeDeep({ ...current }, config));
  }

  private _updateConfig(config: AppConfig): void {
    this._setLayoutClass(config.bodyClass);
    this._setStyle(config.style);
    this._setDensity();
    this._setDirection(config.direction);
    this._setSidenavState(config.sidenav.state);
    this._emitResize();
  }

  private _setStyle(style: AppConfig["style"]): void {
    /**
     * Set light/dark mode
     */
    switch (style.colorScheme) {
      case AppColorScheme.LIGHT:
        this.document.body.classList.remove(AppColorScheme.DARK);
        this.document.body.classList.add(AppColorScheme.LIGHT);
        break;

      case AppColorScheme.DARK:
        this.document.body.classList.remove(AppColorScheme.LIGHT);
        this.document.body.classList.add(AppColorScheme.DARK);
        break;
    }

    /**
     * Set theme class
     */
    this.document.body.classList.remove(...this.themes.map((t) => t.className));
    this.document.body.classList.add(style.themeClassName);

    /**
     * Border Radius
     */
    this.document.body.style.setProperty(
      "--app-border-radius",
      `${style.borderRadius.value}${style.borderRadius.unit}`,
    );

    const buttonBorderRadius: CSSValue =
      style.button.borderRadius ?? style.borderRadius;
    this.document.body.style.setProperty(
      "--app-button-border-radius",
      `${buttonBorderRadius.value}${buttonBorderRadius.unit}`,
    );
  }

  private _setDensity(): void {
    if (!this.document.body.classList.contains("app-mat-dense-default")) {
      this.document.body.classList.add("app-mat-dense-default");
    }
  }

  /**
   * Emit event so charts and other external libraries know they have to resize on layout switch
   * @private
   */
  private _emitResize(): void {
    if (window) {
      window.dispatchEvent(new Event("resize"));
      setTimeout(() => window.dispatchEvent(new Event("resize")), 200);
    }
  }

  private _setDirection(direction: "ltr" | "rtl") {
    this.document.body.dir = direction;
  }

  private _setSidenavState(sidenavState: "expanded" | "collapsed"): void {
    if (sidenavState === "expanded") {
      this.layoutService.expandSidenav();
    } else {
      this.layoutService.collapseSidenav();
    }
  }

  private _setLayoutClass(bodyClass: string): void {
    this.configs.forEach((c) => {
      if (this.document.body.classList.contains(c.bodyClass)) {
        this.document.body.classList.remove(c.bodyClass);
      }
    });

    this.document.body.classList.add(bodyClass);
  }
}
