import { Service, signal } from "@angular/core";
import { environment } from "../../../environments/environment";

interface RuntimeConfig {
  apiUrl?: string;
}

function isRuntimeConfig(value: unknown): value is RuntimeConfig {
  return (
    !!value &&
    typeof value === "object" &&
    (!("apiUrl" in value) || typeof value.apiUrl === "string")
  );
}

/**
 * Settings that can change per deployment. Defaults come from the build-time
 * `environment`; a `config.json` served next to `index.html` overrides them, so
 * one image works in every environment (the Docker image generates that file
 * from the `API_URL` variable).
 */
@Service()
export class SettingsService {
  private readonly _apiUrl = signal(environment.apiUrl);
  readonly apiUrl = this._apiUrl.asReadonly();

  /** Called once before the app starts. Never rejects. */
  async load(): Promise<void> {
    try {
      const response = await fetch("config.json", { cache: "no-store" });
      const config: unknown = response.ok ? await response.json() : null;

      if (isRuntimeConfig(config) && config.apiUrl) {
        this._apiUrl.set(config.apiUrl.replace(/\/+$/, ""));
      }
    } catch {
      // No config.json (e.g. `ng serve`) or it is not valid JSON: keep the defaults
    }
  }

  /** Builds an API URL from a path such as `/customers` */
  api(path: string): string {
    return `${this._apiUrl()}${path}`;
  }
}
