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

/** The toolbar loads the leagues of the user; with one, it is selected by itself */
async function mockMyLeagues(
  page: Page,
  leagues: { id: number; name: string }[],
): Promise<void> {
  await page.route(/\/my-leagues(\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: leagues,
        links: { first: null, last: "x", prev: null, next: null },
        meta: {
          currentPage: 1,
          from: leagues.length ? 1 : null,
          lastPage: 1,
          perPage: 100,
          to: leagues.length || null,
          total: leagues.length,
        },
      },
    }),
  );
}

export interface GotoOptions {
  /** Leagues of the user; with several (or none) no league is active by itself */
  leagues?: { id: number; name: string }[];
}

/** Waits for the splash screen to disappear and, for pages inside the layout, for it to be ready */
export async function gotoApp(
  page: Page,
  path = "/dashboard",
  { leagues = [{ id: 1, name: "Liga de prueba" }] }: GotoOptions = {},
): Promise<void> {
  if (path.startsWith("/dashboard")) {
    await mockSession(page);
    await mockMyLeagues(page, leagues);
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

export interface MockTournament {
  id: number;
  league_id: number;
  name: string;
  gender: "male" | "female" | "mixed";
  min_age: number | null;
  max_age: number | null;
  start_date: string;
  max_roster_size: number | null;
  min_matches_for_playoffs: number | null;
  playoffs_started: boolean;
  status: "planning" | "in_progress" | "finished";
  created_at: string;
}

const GENDERS = ["male", "female", "mixed"] as const;
const STATUSES = ["planning", "in_progress", "finished"] as const;

/** Deterministic tournaments of league 1, newest first by id */
export function makeTournaments(count: number): MockTournament[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    league_id: 1,
    name: `Torneo ${String(i + 1).padStart(2, "0")}`,
    gender: GENDERS[i % 3],
    min_age: i % 4 === 0 ? 18 : null,
    max_age: i % 4 === 0 ? 35 : null,
    start_date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
    max_roster_size: null,
    min_matches_for_playoffs: null,
    playoffs_started: false,
    status: STATUSES[i % 3],
    created_at: new Date(
      FIXED_NOW.getTime() - (i + 1) * 86_400_000,
    ).toISOString(),
  }));
}

export interface TournamentsApi {
  /** Query strings of every `GET /tournaments` so far */
  queries: URLSearchParams[];
  /** Ids of the tournaments deleted so far */
  deleted: number[];
  /** `{ id, status }` of every `PATCH /status` so far */
  statusChanges: { id: number; status: string }[];
  /** Bodies of the `POST /tournaments` so far */
  created: unknown[];
}

/** Stubs `/leagues/1/tournaments`: filters, sort and pagination work like the real list */
export async function mockTournamentsApi(
  page: Page,
  { tournaments = [] }: { tournaments?: MockTournament[] } = {},
): Promise<TournamentsApi> {
  const state = [...tournaments];
  const api: TournamentsApi = {
    queries: [],
    deleted: [],
    statusChanges: [],
    created: [],
  };

  await page.route(/\/tournaments\/\d+\/status$/, (route) => {
    const id = Number(route.request().url().split("/").at(-2));
    const { status } = route.request().postDataJSON() as { status: string };
    api.statusChanges.push({ id, status });
    const found = state.find((t) => t.id === id);

    if (found) {
      found.status = status as MockTournament["status"];
    }

    return route.fulfill({ json: found ?? {} });
  });

  await page.route(/\/tournaments\/\d+$/, (route) => {
    if (route.request().method() === "DELETE") {
      const id = Number(route.request().url().split("/").pop());
      api.deleted.push(id);
      state.splice(0, state.length, ...state.filter((t) => t.id !== id));

      return route.fulfill({ status: 204 });
    }

    return route.fulfill({ json: {} });
  });

  await page.route(/\/tournaments(\?.*)?$/, (route) => {
    const request = route.request();

    if (request.method() === "POST") {
      api.created.push(request.postDataJSON());

      return route.fulfill({ status: 201, json: state[0] ?? {} });
    }

    const query = new URL(request.url()).searchParams;
    api.queries.push(query);

    const search = (query.get("search") ?? "").toLowerCase();
    const sort = query.get("sort") ?? "-created_at";
    const field = sort.replace(/^-/, "") as keyof MockTournament;
    const direction = sort.startsWith("-") ? -1 : 1;
    const perPage = Number(query.get("per_page") ?? 5);
    const current = Number(query.get("page") ?? 1);

    const matching = state
      .filter(
        (t) =>
          t.name.toLowerCase().includes(search) &&
          (!query.get("gender") || t.gender === query.get("gender")) &&
          (!query.get("status") || t.status === query.get("status")),
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

export interface MockReferee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  user_code: string;
  photo_url: string | null;
  account_status: "pending" | "active" | "inactive";
  status: "active" | "inactive";
  created_at: string;
}

/** Deterministic referees of league 1, newest first by id */
export function makeReferees(count: number): MockReferee[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    first_name: FIRST_NAMES[i % FIRST_NAMES.length],
    last_name: LAST_NAMES[i % LAST_NAMES.length],
    email: `arbitro${i + 1}@example.com`,
    phone: i % 2 === 0 ? "5512345678" : null,
    user_code: `ARB${String(i + 1).padStart(4, "0")}`,
    photo_url: null,
    account_status: i % 3 === 1 ? "pending" : "active",
    status: i % 4 === 3 ? "inactive" : "active",
    created_at: new Date(
      FIXED_NOW.getTime() - (i + 1) * 86_400_000,
    ).toISOString(),
  }));
}

export interface RefereesApiOptions {
  referees?: MockReferee[];
  /** What `POST /referees` answers (default: 201 with an empty body) */
  create?: { status: number; body: unknown };
  /** What `GET /referees/lookup` answers (default: 404) */
  lookup?: { status: number; body?: unknown };
}

export interface RefereesApi {
  /** Query strings of every `GET /referees` so far */
  queries: URLSearchParams[];
  /** Ids of the referees removed so far */
  removed: number[];
  /** `{ id, status }` of every `PATCH /status` so far */
  statusChanges: { id: number; status: string }[];
  /** Bodies of the `POST /referees` so far */
  created: unknown[];
  /** Bodies of the `POST /referees/attach` so far */
  attached: unknown[];
}

/** Stubs `/leagues/1/referees`: search, filter, sort and pagination work like the real list */
export async function mockRefereesApi(
  page: Page,
  { referees = [], create, lookup }: RefereesApiOptions = {},
): Promise<RefereesApi> {
  const state = [...referees];
  const api: RefereesApi = {
    queries: [],
    removed: [],
    statusChanges: [],
    created: [],
    attached: [],
  };

  await page.route(/\/referees\/lookup(\?.*)?$/, (route) =>
    route.fulfill({
      status: lookup?.status ?? 404,
      json: lookup?.body ?? { code: 404, error: "No encontrado." },
    }),
  );

  await page.route(/\/referees\/attach$/, (route) => {
    api.attached.push(route.request().postDataJSON());

    return route.fulfill({ status: 201, json: {} });
  });

  await page.route(/\/referees\/\d+\/status$/, (route) => {
    const id = Number(route.request().url().split("/").at(-2));
    const { status } = route.request().postDataJSON() as { status: string };
    api.statusChanges.push({ id, status });
    const found = state.find((r) => r.id === id);

    if (found) {
      found.status = status as MockReferee["status"];
    }

    return route.fulfill({ json: found ?? {} });
  });

  await page.route(/\/referees\/\d+$/, (route) => {
    if (route.request().method() === "DELETE") {
      const id = Number(route.request().url().split("/").pop());
      api.removed.push(id);
      state.splice(0, state.length, ...state.filter((r) => r.id !== id));

      return route.fulfill({ status: 204 });
    }

    return route.fulfill({ json: {} });
  });

  await page.route(/\/referees(\?.*)?$/, (route) => {
    const request = route.request();

    if (request.method() === "POST") {
      api.created.push(request.postDataJSON());

      return route.fulfill(
        create
          ? { status: create.status, json: create.body }
          : { status: 201, json: {} },
      );
    }

    const query = new URL(request.url()).searchParams;
    api.queries.push(query);

    const search = (query.get("search") ?? "").toLowerCase();
    const sort = query.get("sort") ?? "-created_at";
    const field = sort.replace(/^-/, "") as keyof MockReferee;
    const direction = sort.startsWith("-") ? -1 : 1;
    const perPage = Number(query.get("per_page") ?? 5);
    const current = Number(query.get("page") ?? 1);

    const matching = state
      .filter(
        (r) =>
          `${r.first_name} ${r.last_name} ${r.email}`
            .toLowerCase()
            .includes(search) &&
          (!query.get("status") || r.status === query.get("status")),
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

export interface MockField {
  id: number;
  league_id: number;
  name: string;
  status: "active" | "inactive";
  created_at: string;
}

/** Deterministic fields of league 1, newest first by id */
export function makeFields(count: number): MockField[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    league_id: 1,
    name: `Cancha ${String(i + 1).padStart(2, "0")}`,
    status: i % 4 === 3 ? "inactive" : "active",
    created_at: new Date(
      FIXED_NOW.getTime() - (i + 1) * 86_400_000,
    ).toISOString(),
  }));
}

export interface FieldsApiOptions {
  fields?: MockField[];
  /** What `POST /fields` answers (default: 201 with the new field) */
  create?: { status: number; body: unknown };
}

export interface FieldsApi {
  /** Query strings of every `GET /fields` so far */
  queries: URLSearchParams[];
  /** Ids of the fields deleted so far */
  deleted: number[];
  /** `{ id, status }` of every `PATCH /status` so far */
  statusChanges: { id: number; status: string }[];
  /** Bodies of the `POST /fields` so far */
  created: unknown[];
  /** `{ id, body }` of every `PUT /fields/{id}` so far */
  updated: { id: number; body: unknown }[];
}

/** Stubs `/leagues/1/fields`: search, filter, sort and pagination work like the real list */
export async function mockFieldsApi(
  page: Page,
  { fields = [], create }: FieldsApiOptions = {},
): Promise<FieldsApi> {
  const state = [...fields];
  const api: FieldsApi = {
    queries: [],
    deleted: [],
    statusChanges: [],
    created: [],
    updated: [],
  };

  await page.route(/\/fields\/\d+\/status$/, (route) => {
    const id = Number(route.request().url().split("/").at(-2));
    const { status } = route.request().postDataJSON() as { status: string };
    api.statusChanges.push({ id, status });
    const found = state.find((f) => f.id === id);

    if (found) {
      found.status = status as MockField["status"];
    }

    return route.fulfill({ json: found ?? {} });
  });

  await page.route(/\/fields\/\d+$/, (route) => {
    const request = route.request();
    const id = Number(request.url().split("/").pop());

    if (request.method() === "DELETE") {
      api.deleted.push(id);
      state.splice(0, state.length, ...state.filter((f) => f.id !== id));

      return route.fulfill({ status: 204 });
    }

    const body = request.postDataJSON() as { name: string };
    api.updated.push({ id, body });
    const found = state.find((f) => f.id === id);

    if (found) {
      found.name = body.name;
    }

    return route.fulfill({ json: found ?? {} });
  });

  await page.route(/\/fields(\?.*)?$/, (route) => {
    const request = route.request();

    if (request.method() === "POST") {
      const body = request.postDataJSON() as {
        name: string;
        status: MockField["status"];
      };
      api.created.push(body);

      if (create) {
        return route.fulfill({ status: create.status, json: create.body });
      }

      const next: MockField = {
        id: Math.max(0, ...state.map((f) => f.id)) + 1,
        league_id: 1,
        name: body.name,
        status: body.status,
        created_at: FIXED_NOW.toISOString(),
      };
      state.push(next);

      return route.fulfill({ status: 201, json: next });
    }

    const query = new URL(request.url()).searchParams;
    api.queries.push(query);

    const search = (query.get("search") ?? "").toLowerCase();
    const sort = query.get("sort") ?? "-created_at";
    const field = sort.replace(/^-/, "") as keyof MockField;
    const direction = sort.startsWith("-") ? -1 : 1;
    const perPage = Number(query.get("per_page") ?? 5);
    const current = Number(query.get("page") ?? 1);

    const matching = state
      .filter(
        (f) =>
          f.name.toLowerCase().includes(search) &&
          (!query.get("status") || f.status === query.get("status")),
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

export interface MockTeam {
  id: number;
  name: string;
  logo_url: string | null;
  status: "active" | "banned";
  manager: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    user_code: string;
    photo_url: string | null;
    account_status: "pending" | "active" | "inactive";
  } | null;
  created_at: string;
}

/** Deterministic teams of league 1, newest first by id: every third one has no delegate */
export function makeTeams(count: number): MockTeam[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Equipo ${String(i + 1).padStart(2, "0")}`,
    logo_url: null,
    status: i % 4 === 3 ? "banned" : "active",
    manager:
      i % 3 === 2
        ? null
        : {
            id: 100 + i,
            first_name: FIRST_NAMES[i % FIRST_NAMES.length],
            last_name: LAST_NAMES[i % LAST_NAMES.length],
            email: `delegado${i + 1}@example.com`,
            phone: null,
            user_code: `DEL${String(i + 1).padStart(4, "0")}`,
            photo_url: null,
            account_status: i % 3 === 1 ? "pending" : "active",
          },
    created_at: new Date(
      FIXED_NOW.getTime() - (i + 1) * 86_400_000,
    ).toISOString(),
  }));
}

export interface TeamsApiOptions {
  teams?: MockTeam[];
  /** What `POST /teams` answers (default: 201 with the new team) */
  create?: { status: number; body: unknown };
  /** What `GET /manager-lookup` answers (default: 404) */
  lookup?: { status: number; body?: unknown };
  /** What `PUT /teams/{id}/manager` answers (default: 200 with the team) */
  assign?: { status: number; body: unknown };
  /** What `DELETE /teams/{id}/manager` answers (default: 204) */
  unassign?: { status: number; body: unknown };
}

export interface TeamsApi {
  /** Query strings of every `GET /teams` so far */
  queries: URLSearchParams[];
  /** Bodies of the `POST /teams` so far */
  created: unknown[];
  /** Ids of the teams deleted so far */
  deleted: number[];
  /** `{ id, status }` of every `PATCH /status` so far */
  statusChanges: { id: number; status: string }[];
  /** `{ id, body }` of every `PUT /teams/{id}/manager` so far */
  managerSet: { id: number; body: unknown }[];
  /** Ids of the teams whose delegate was removed so far */
  managerRemoved: number[];
  /** `{ id, contentType }` of every `POST /teams/{id}/logo` so far */
  logos: { id: number; contentType: string }[];
}

/** Stubs `/leagues/1/teams`: search, filters, sort and pagination work like the real list */
export async function mockTeamsApi(
  page: Page,
  { teams = [], create, lookup, assign, unassign }: TeamsApiOptions = {},
): Promise<TeamsApi> {
  const state = [...teams];
  const api: TeamsApi = {
    queries: [],
    created: [],
    deleted: [],
    statusChanges: [],
    managerSet: [],
    managerRemoved: [],
    logos: [],
  };
  const idOf = (url: string, fromEnd: number) =>
    Number(new URL(url).pathname.split("/").at(-fromEnd));

  await page.route(/\/teams\/managers$/, (route) =>
    route.fulfill({
      json: [
        ...new Map(
          state.flatMap((t) => (t.manager ? [[t.manager.id, t.manager]] : [])),
        ).values(),
      ].map(({ id, first_name, last_name }) => ({ id, first_name, last_name })),
    }),
  );

  await page.route(/\/manager-lookup(\?.*)?$/, (route) =>
    route.fulfill({
      status: lookup?.status ?? 404,
      json: lookup?.body ?? { code: 404, error: "No encontrado." },
    }),
  );

  await page.route(/\/teams\/\d+\/logo$/, (route) => {
    const request = route.request();
    const id = idOf(request.url(), 2);

    if (request.method() === "POST") {
      api.logos.push({
        id,
        contentType: request.headers()["content-type"] ?? "",
      });
    }

    return route.fulfill({
      status: request.method() === "DELETE" ? 204 : 200,
      json: state.find((t) => t.id === id) ?? {},
    });
  });

  await page.route(/\/teams\/\d+\/manager$/, (route) => {
    const request = route.request();
    const id = idOf(request.url(), 2);
    const found = state.find((t) => t.id === id);

    if (request.method() === "DELETE") {
      if (unassign) {
        return route.fulfill({ status: unassign.status, json: unassign.body });
      }

      api.managerRemoved.push(id);

      if (found) {
        found.manager = null;
      }

      return route.fulfill({ status: 204 });
    }

    api.managerSet.push({ id, body: request.postDataJSON() });

    if (assign) {
      return route.fulfill({ status: assign.status, json: assign.body });
    }

    return route.fulfill({ json: found ?? {} });
  });

  await page.route(/\/teams\/\d+\/status$/, (route) => {
    const id = idOf(route.request().url(), 2);
    const { status } = route.request().postDataJSON() as { status: string };
    api.statusChanges.push({ id, status });
    const found = state.find((t) => t.id === id);

    if (found) {
      found.status = status as MockTeam["status"];
    }

    return route.fulfill({ json: found ?? {} });
  });

  await page.route(/\/teams\/\d+$/, (route) => {
    const request = route.request();
    const id = idOf(request.url(), 1);

    if (request.method() === "DELETE") {
      api.deleted.push(id);
      state.splice(0, state.length, ...state.filter((t) => t.id !== id));

      return route.fulfill({ status: 204 });
    }

    const found = state.find((t) => t.id === id);

    if (found) {
      found.name = (request.postDataJSON() as { name: string }).name;
    }

    return route.fulfill({ json: found ?? {} });
  });

  await page.route(/\/teams(\?.*)?$/, (route) => {
    const request = route.request();

    if (request.method() === "POST") {
      const body = request.postDataJSON() as {
        name: string;
        manager?: Record<string, string>;
      };
      api.created.push(body);

      if (create) {
        return route.fulfill({ status: create.status, json: create.body });
      }

      const next: MockTeam = {
        id: Math.max(0, ...state.map((t) => t.id)) + 1,
        name: body.name,
        logo_url: null,
        status: "active",
        manager: body.manager?.first_name
          ? {
              id: 900,
              first_name: body.manager.first_name,
              last_name: body.manager.last_name,
              email: body.manager.email,
              phone: null,
              user_code: "NEW0001",
              photo_url: null,
              account_status: "pending",
            }
          : null,
        created_at: FIXED_NOW.toISOString(),
      };
      state.push(next);

      return route.fulfill({ status: 201, json: next });
    }

    const query = new URL(request.url()).searchParams;
    api.queries.push(query);

    const search = (query.get("search") ?? "").toLowerCase();
    const sort = query.get("sort") ?? "-created_at";
    const field = sort.replace(/^-/, "") as keyof MockTeam;
    const direction = sort.startsWith("-") ? -1 : 1;
    const perPage = Number(query.get("per_page") ?? 5);
    const current = Number(query.get("page") ?? 1);

    const matching = state
      .filter(
        (t) =>
          `${t.name} ${t.manager?.first_name ?? ""} ${t.manager?.last_name ?? ""}`
            .toLowerCase()
            .includes(search) &&
          (!query.get("status") || t.status === query.get("status")) &&
          (query.get("has_manager") !== "false" || t.manager === null) &&
          (!query.get("manager_user_id") ||
            t.manager?.id === Number(query.get("manager_user_id"))),
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
