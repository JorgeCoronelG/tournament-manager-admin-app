export interface AppEnvironment {
  production: boolean;
  /**
   * Base URL of the API. It can be overridden at runtime with `config.json`
   * (see SettingsService), so the same build can be deployed anywhere.
   */
  apiUrl: string;
  /**
   * Base URL of the authentication API (separate backend). It can also be
   * overridden at runtime with `config.json` (see SettingsService).
   */
  authApiUrl: string;
  features: {
    /** Route `/styleguide` with every Material component, used to review themes */
    styleguide: boolean;
  };
}
