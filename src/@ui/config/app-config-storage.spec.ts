import { appConfigs } from "./app-configs";
import { AppColorScheme, AppConfigName } from "./app-config.interface";
import {
  applyPreferences,
  readPreferences,
  toPreferences,
  writePreferences,
} from "./app-config-storage";

describe("app config storage", () => {
  const themes = ["app-theme-default", "app-theme-teal"];

  beforeEach(() => localStorage.clear());

  it("round-trips the preferences that the config panel can change", () => {
    const config = {
      ...appConfigs.hermes,
      direction: "rtl" as const,
      style: {
        ...appConfigs.hermes.style,
        themeClassName: "app-theme-teal",
        colorScheme: AppColorScheme.DARK,
        button: { borderRadius: undefined },
      },
    };

    writePreferences(toPreferences(config));
    const restored = readPreferences(themes);

    expect(restored).not.toBeNull();

    const applied = applyPreferences(appConfigs.hermes, restored!);
    expect(applied.direction).toBe("rtl");
    expect(applied.style.themeClassName).toBe("app-theme-teal");
    expect(applied.style.colorScheme).toBe(AppColorScheme.DARK);
    expect(applied.style.button.borderRadius).toBeUndefined();
    expect(applied.id).toBe(AppConfigName.hermes);
  });

  it("keeps everything else coming from the code", () => {
    const stored = toPreferences(appConfigs.zeus);
    const applied = applyPreferences(appConfigs.zeus, stored);

    expect(applied.sidenav).toEqual(appConfigs.zeus.sidenav);
    expect(applied.bodyClass).toBe(appConfigs.zeus.bodyClass);
  });

  it("ignores missing, corrupt or unknown values", () => {
    expect(readPreferences(themes)).toBeNull();

    localStorage.setItem("app.preferences.v1", "{not json");
    expect(readPreferences(themes)).toBeNull();

    const unknownTheme = toPreferences(appConfigs.apollo);
    unknownTheme.style.themeClassName = "app-theme-removed";
    writePreferences(unknownTheme);
    expect(readPreferences(themes)).toBeNull();
  });
});
