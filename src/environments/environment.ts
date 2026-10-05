import { AppEnvironment } from "./environment.model";

/** Development (`ng serve`) */
export const environment: AppEnvironment = {
  production: false,
  apiUrl: "http://localhost:8000/api",
  authApiUrl: "http://localhost:8000/api",
  features: { styleguide: true },
};
