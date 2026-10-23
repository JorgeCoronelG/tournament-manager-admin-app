const PREFIX = "app.active-league.";

const keyFor = (userId: number): string => `${PREFIX}${userId}`;

/** The league the user had open last time, or null if there is none (or storage fails) */
export function readActiveLeagueId(userId: number): number | null {
  try {
    const stored = localStorage.getItem(keyFor(userId));
    const id = stored === null ? NaN : Number(stored);

    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function writeActiveLeagueId(userId: number, id: number | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(keyFor(userId));
    } else {
      localStorage.setItem(keyFor(userId), String(id));
    }
  } catch {
    // Storage can be unavailable (private mode, quota): the choice just won't persist
  }
}

/**
 * Forgets the league chosen by every user of this browser. A session that ends
 * on a reload (an invalid token) does not know whose user it was, so the key of
 * a single user cannot be targeted.
 */
export function clearActiveLeagueIds(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage can be unavailable (private mode): there is nothing saved to forget
  }
}
