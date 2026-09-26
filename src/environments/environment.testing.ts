import { AppEnvironment } from "./environment.model";

/** Unit tests */
export const environment: AppEnvironment = {
  production: false,
  apiUrl: "http://api.test",
  features: { styleguide: false },
};
