export interface AppEnvironment {
  production: boolean;
  /**
   * Base URL of the API. It can be overridden at runtime with `config.json`
   * (see SettingsService), so the same build can be deployed anywhere.
   */
  apiUrl: string;
  features: {
    /** Route `/styleguide` with every Material component, used to review themes */
    styleguide: boolean;
  };
}
