import { CSSValue } from "../interfaces/css-value.type";

export enum AppTheme {
  DEFAULT = "app-theme-default",
  TEAL = "app-theme-teal",
}

export enum AppConfigName {
  apollo = "apollo",
  zeus = "zeus",
  hermes = "hermes",
  poseidon = "poseidon",
  ares = "ares",
  ikaros = "ikaros",
}

export enum AppColorScheme {
  LIGHT = "light",
  DARK = "dark",
}

export interface AppConfig {
  id: AppConfigName;
  name: string;
  bodyClass: string;
  direction: "ltr" | "rtl";
  style: {
    themeClassName: string;
    colorScheme: AppColorScheme;
    borderRadius: CSSValue;
    button: {
      borderRadius: CSSValue | undefined;
    };
  };
  layout: "vertical" | "horizontal";
  boxed: boolean;
  sidenav: {
    title: string;
    imageUrl: string;
    showCollapsePin: boolean;
    user: {
      visible: boolean;
    };
    state: "expanded" | "collapsed";
  };
  toolbar: {
    fixed: boolean;
    user: {
      visible: boolean;
    };
  };
  navbar: {
    position: "below-toolbar" | "in-toolbar";
  };
  footer: {
    visible: boolean;
    fixed: boolean;
  };
}

export type AppConfigs = Record<AppConfigName, AppConfig>;

export interface AppThemeProvider {
  name: string;
  className: string;
}
