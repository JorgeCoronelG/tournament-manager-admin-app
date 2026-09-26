import { TranslocoPipe } from "@jsverse/transloco";
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
} from "@angular/core";
import { AppConfigService } from "@ui/config/app-config.service";
import {
  MatSlideToggleChange,
  MatSlideToggleModule,
} from "@angular/material/slide-toggle";
import { MatRadioChange, MatRadioModule } from "@angular/material/radio";
import { UpperCasePipe } from "@angular/common";
import {
  AppColorScheme,
  AppConfig,
  AppConfigName,
  AppThemeProvider,
} from "@ui/config/app-config.interface";
import { CSSValue } from "@ui/interfaces/css-value.type";
import { isNil } from "@ui/utils/is-nil";
import { defaultRoundedButtonBorderRadius } from "@ui/config/constants";
import { MatButtonModule } from "@angular/material/button";
import { MatRippleModule } from "@angular/material/core";
import { MatIconModule } from "@angular/material/icon";
import { APP_THEMES } from "@ui/config/config.token";

@Component({
  selector: "app-config-panel",
  templateUrl: "./config-panel.component.html",
  styleUrls: ["./config-panel.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoPipe,
    MatIconModule,
    MatRippleModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatRadioModule,
    UpperCasePipe,
  ],
})
export class ConfigPanelComponent {
  private readonly configService = inject(AppConfigService);
  readonly themes = inject(APP_THEMES);

  configs: AppConfig[] = this.configService.configs;
  readonly config = this.configService.config;

  readonly isRTL = computed(() => this.config().direction === "rtl");
  readonly colorScheme = computed(() => this.config().style.colorScheme);
  readonly selectedTheme = computed(() => this.config().style.themeClassName);

  ConfigName = AppConfigName;
  ColorSchemeName = AppColorScheme;

  roundedCornerValues: CSSValue[] = [
    {
      value: 0,
      unit: "rem",
    },
    {
      value: 0.25,
      unit: "rem",
    },
    {
      value: 0.5,
      unit: "rem",
    },
    {
      value: 0.75,
      unit: "rem",
    },
    {
      value: 1,
      unit: "rem",
    },
    {
      value: 1.25,
      unit: "rem",
    },
    {
      value: 1.5,
      unit: "rem",
    },
    {
      value: 1.75,
      unit: "rem",
    },
  ];

  roundedButtonValue: CSSValue = defaultRoundedButtonBorderRadius;

  themeClass(theme: AppThemeProvider): string {
    const state =
      this.selectedTheme() === theme.className
        ? "bg-primary-600 text-on-primary-600"
        : "bg-primary-600/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-500";

    return `${theme.className} app-color-picker rounded-full mt-2 flex items-center cursor-pointer relative hover:bg-primary-600 hover:text-on-primary-600 dark:hover:bg-primary-600 dark:hover:text-on-primary-600 w-full text-start ${state}`;
  }

  setConfig(layout: AppConfigName, colorScheme: AppColorScheme): void {
    this.configService.setConfig(layout);
    this.configService.updateConfig({
      style: {
        colorScheme,
      },
    });
  }

  selectTheme(theme: AppThemeProvider): void {
    this.configService.updateConfig({
      style: {
        themeClassName: theme.className,
      },
    });
  }

  enableDarkMode(): void {
    this.configService.updateConfig({
      style: {
        colorScheme: AppColorScheme.DARK,
      },
    });
  }

  disableDarkMode(): void {
    this.configService.updateConfig({
      style: {
        colorScheme: AppColorScheme.LIGHT,
      },
    });
  }

  layoutRTLChange(change: MatSlideToggleChange): void {
    this.configService.updateConfig({
      direction: change.checked ? "rtl" : "ltr",
    });
  }

  toolbarPositionChange(change: MatRadioChange): void {
    this.configService.updateConfig({
      toolbar: {
        fixed: change.value === "fixed",
      },
    });
  }

  footerVisibleChange(change: MatSlideToggleChange): void {
    this.configService.updateConfig({
      footer: {
        visible: change.checked,
      },
    });
  }

  footerPositionChange(change: MatRadioChange): void {
    this.configService.updateConfig({
      footer: {
        fixed: change.value === "fixed",
      },
    });
  }

  isSelectedBorderRadius(borderRadius: CSSValue, config: AppConfig): boolean {
    return (
      borderRadius.value === config.style.borderRadius.value &&
      borderRadius.unit === config.style.borderRadius.unit
    );
  }

  selectBorderRadius(borderRadius: CSSValue): void {
    this.configService.updateConfig({
      style: {
        borderRadius: borderRadius,
      },
    });
  }

  isSelectedButtonStyle(
    buttonStyle: CSSValue | undefined,
    config: AppConfig,
  ): boolean {
    if (isNil(config.style.button.borderRadius) && isNil(buttonStyle)) {
      return true;
    }

    return buttonStyle?.value === config.style.button.borderRadius?.value;
  }

  selectButtonStyle(borderRadius: CSSValue | undefined): void {
    this.configService.updateConfig({
      style: {
        button: {
          borderRadius: borderRadius,
        },
      },
    });
  }

  isDark(colorScheme: AppColorScheme): boolean {
    return colorScheme === AppColorScheme.DARK;
  }
}
