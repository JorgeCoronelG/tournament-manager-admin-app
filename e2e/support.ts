import { Page } from "@playwright/test";

/** A fixed "now" so relative dates ("3 months ago") never change between runs */
export const FIXED_NOW = new Date("2026-09-19T12:00:00Z");

export async function freezeTime(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_NOW);
}

/**
 * `/dashboard/**` is behind `authGuard`, which checks the stored token against
 * `GET /user` (see `AuthSessionService`). There is no auth backend in the e2e
 * stack, so we seed a fake token and stub that request instead.
 */
async function mockSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("app.auth.token", "e2e-fake-token");
  });

  // Empty names/photo_url/role name keep the "Guest" look the screenshots were baselined with;
  // the superadmin role is what shows the whole menu
  await page.route("http://localhost:8000/api/user", (route) =>
    route.fulfill({
      json: {
        id: 1,
        first_name: "",
        last_name: "",
        email: "e2e@example.com",
        photo_url: "",
        roles: [{ id: 1, code: "superadmin", name: "" }],
      },
    }),
  );
}

/** Waits for the splash screen to disappear and, for pages inside the layout, for it to be ready */
export async function gotoApp(page: Page, path = "/dashboard"): Promise<void> {
  if (path.startsWith("/dashboard")) {
    await mockSession(page);
  }

  await page.goto(path);
  await page.locator("#app-splash-screen").waitFor({ state: "detached" });
  if (path.startsWith("/dashboard")) {
    await page.locator("app-sidenav").waitFor();
  }
}

const FIRST_NAMES = [
  "Ana",
  "Bruno",
  "Carla",
  "Diego",
  "Elena",
  "Fabián",
  "Gloria",
  "Héctor",
  "Irene",
  "Javier",
  "Karla",
  "Luis",
  "Marta",
  "Néstor",
  "Olga",
  "Pablo",
  "Quetzal",
  "Rosa",
  "Sergio",
  "Tania",
  "Ulises",
  "Valeria",
  "Xavier",
  "Yolanda",
  "Zacarías",
];
const LAST_NAMES = ["Pérez", "García", "López", "Martínez", "Hernández"];

export interface MockUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  user_code: string;
  photo_url: string | null;
  is_active: boolean;
  email_verified_at: string | null;
  status: "pending" | "active" | "inactive";
  roles: { id: number; code: string; name: string }[];
  created_at: string;
}

const ROLES = [
  { id: 2, code: "league_admin", name: "Administrador Liga" },
  { id: 3, code: "referee", name: "Árbitro" },
  { id: 4, code: "player", name: "Jugador" },
];

/** Deterministic users (up to 25 distinct first names), newest first by id */
export function makeUsers(count: number): MockUser[] {
  return Array.from({ length: count }, (_, i) => {
    const status =
      i % 5 === 3 ? "pending" : i % 5 === 4 ? "inactive" : "active";

    return {
      id: i + 1,
      first_name: FIRST_NAMES[i % FIRST_NAMES.length],
      last_name: LAST_NAMES[i % LAST_NAMES.length],
      email: `${FIRST_NAMES[i % FIRST_NAMES.length].toLowerCase()}@example.com`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, ""),
      phone: i % 2 === 0 ? "5512345678" : null,
      user_code: `U${String(i + 1).padStart(4, "0")}`,
      photo_url: null,
      is_active: status !== "inactive",
      email_verified_at: status === "pending" ? null : "2026-09-01T12:00:00Z",
      status,
      roles: i % 3 === 0 ? [ROLES[0]] : [],
      created_at: new Date(
        FIXED_NOW.getTime() - (i + 1) * 86_400_000,
      ).toISOString(),
    } satisfies MockUser;
  });
}

export interface UsersApiOptions {
  users?: MockUser[];
  /** What `POST /users` answers (default: 201 with the created user) */
  create?: { status: number; body: unknown };
}

export interface UsersApi {
  /** Query strings of every `GET /users` so far */
  queries: URLSearchParams[];
  /** Ids of the users deleted so far */
  deleted: number[];
  /** Bodies of the `POST /users` so far */
  created: unknown[];
}

/**
 * Stubs the users and roles endpoints of the backend, which the e2e stack does not
 * have: search, sort and pagination work like the real list, and deletes remove the user.
 */
export async function mockUsersApi(
  page: Page,
  { users = [], create }: UsersApiOptions = {},
): Promise<UsersApi> {
  const state = [...users];
  const api: UsersApi = { queries: [], deleted: [], created: [] };

  await page.route(/\/roles$/, (route) => route.fulfill({ json: ROLES }));

  await page.route(/\/users\/\d+$/, (route) => {
    if (route.request().method() === "DELETE") {
      const id = Number(route.request().url().split("/").pop());
      api.deleted.push(id);
      state.splice(0, state.length, ...state.filter((user) => user.id !== id));

      return route.fulfill({ status: 204 });
    }

    return route.fulfill({ json: {} });
  });

  await page.route(/\/users(\?.*)?$/, (route) => {
    const request = route.request();

    if (request.method() === "POST") {
      api.created.push(request.postDataJSON());

      return route.fulfill(
        create
          ? { status: create.status, json: create.body }
          : { status: 201, json: state[0] ?? {} },
      );
    }

    const query = new URL(request.url()).searchParams;
    api.queries.push(query);

    const search = (query.get("search") ?? "").toLowerCase();
    const sort = query.get("sort") ?? "-created_at";
    const field = sort.replace(/^-/, "") as keyof MockUser;
    const direction = sort.startsWith("-") ? -1 : 1;
    const perPage = Number(query.get("per_page") ?? 5);
    const current = Number(query.get("page") ?? 1);

    const matching = state
      .filter((user) =>
        `${user.first_name} ${user.last_name} ${user.email}`
          .toLowerCase()
          .includes(search),
      )
      .sort(
        (a, b) => String(a[field]).localeCompare(String(b[field])) * direction,
      );
    const data = matching.slice((current - 1) * perPage, current * perPage);

    return route.fulfill({
      json: {
        data,
        links: { first: null, last: "x", prev: null, next: null },
        meta: {
          currentPage: current,
          from: data.length ? (current - 1) * perPage + 1 : null,
          lastPage: Math.max(1, Math.ceil(matching.length / perPage)),
          perPage,
          to: data.length ? (current - 1) * perPage + data.length : null,
          total: matching.length,
        },
      },
    });
  });

  return api;
}
