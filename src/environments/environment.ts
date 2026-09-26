import { AppEnvironment } from "./environment.model";

/** Development (`ng serve`) */
export const environment: AppEnvironment = {
  production: false,
  apiUrl: "http://localhost:3000",
  features: { styleguide: true },
};
