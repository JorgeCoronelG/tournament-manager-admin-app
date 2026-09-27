import { Service, signal } from "@angular/core";

const STORAGE_KEY = "app.auth.token";

function readToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode, quota): the token just won't persist
  }
}

/** Holds the bearer token issued on login, persisted across reloads */
@Service()
export class AuthTokenService {
  private readonly _token = signal(readToken());
  readonly token = this._token.asReadonly();

  setToken(token: string): void {
    this._token.set(token);
    writeToken(token);
  }

  clear(): void {
    this._token.set(null);
    writeToken(null);
  }
}
