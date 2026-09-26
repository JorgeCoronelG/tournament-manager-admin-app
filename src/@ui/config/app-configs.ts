import { mergeDeep } from "../utils/merge-deep";
import {
  AppColorScheme,
  AppConfig,
  AppConfigName,
  AppConfigs,
  AppTheme,
} from "./app-config.interface";
import deepClone from "@ui/utils/deep-clone";

const baseConfig: AppConfig = {
  id: AppConfigName.apollo,
  name: "Apollo",
  bodyClass: "app-layout-apollo",
  style: {
    themeClassName: AppTheme.DEFAULT,
    colorScheme: AppColorScheme.LIGHT,
    borderRadius: {
      value: 0.5,
      unit: "rem",
    },
    button: {
      borderRadius: {
        value: 9999,
        unit: "px",
      },
    },
  },
  direction: "ltr",
  layout: "horizontal",
  boxed: false,
  sidenav: {
    title: "Dashboard",
    imageUrl: "assets/img/logo/logo.svg",
    showCollapsePin: true,
    user: {
      visible: true,
    },
    state: "expanded",
  },
  toolbar: {
    fixed: true,
    user: {
      visible: true,
    },
  },
  navbar: {
    position: "below-toolbar",
  },
  footer: {
    visible: true,
    fixed: true,
  },
};

export const appConfigs: AppConfigs = {
  apollo: baseConfig,
  poseidon: mergeDeep(deepClone(baseConfig), {
    id: AppConfigName.poseidon,
    name: "Poseidon",
    bodyClass: "app-layout-poseidon",
    sidenav: {
      user: {
        visible: true,
      },
    },
    toolbar: {
      user: {
        visible: false,
      },
    },
  }),
  hermes: mergeDeep(deepClone(baseConfig), {
    id: AppConfigName.hermes,
    name: "Hermes",
    bodyClass: "app-layout-hermes",
    layout: "vertical",
    boxed: true,
    sidenav: {
      user: {
        visible: false,
      },
    },
    toolbar: {
      fixed: false,
    },
    footer: {
      fixed: false,
    },
  }),
  ares: mergeDeep(deepClone(baseConfig), {
    id: AppConfigName.ares,
    name: "Ares",
    bodyClass: "app-layout-ares",
    sidenav: {
      user: {
        visible: false,
      },
    },
    toolbar: {
      fixed: false,
    },
    navbar: {
      position: "in-toolbar",
    },
    footer: {
      fixed: false,
    },
  }),
  zeus: mergeDeep(deepClone(baseConfig), {
    id: AppConfigName.zeus,
    name: "Zeus",
    bodyClass: "app-layout-zeus",
    sidenav: {
      state: "collapsed",
    },
  }),
  ikaros: mergeDeep(deepClone(baseConfig), {
    id: AppConfigName.ikaros,
    name: "Ikaros",
    bodyClass: "app-layout-ikaros",
    layout: "vertical",
    boxed: true,
    sidenav: {
      user: {
        visible: false,
      },
    },
    toolbar: {
      fixed: false,
    },
    navbar: {
      position: "in-toolbar",
    },
    footer: {
      fixed: false,
    },
  }),
};
