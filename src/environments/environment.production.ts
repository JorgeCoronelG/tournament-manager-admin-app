import { AppEnvironment } from "./environment.model";

/** Production build: same-origin `/api` unless config.json says otherwise */
export const environment: AppEnvironment = {
  production: true,
  apiUrl: "/api",
  features: { styleguide: false },
};
