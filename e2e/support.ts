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
  rounds: 1 | 2;
  match_duration_minutes: number;
  tiebreakers: string[];
  playoffs_started: boolean;
  status: "planning" | "in_progress" | "playoffs" | "finished";
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
    rounds: 1,
    match_duration_minutes: 60,
    tiebreakers: ["points", "goal_difference", "goals_for", "head_to_head"],
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

export interface MockGroupTeam {
  /** Registration id */
  id: number;
  name: string;
  manager: string | null;
  groupId: number | null;
}

export interface MockGroup {
  id: number;
  name: string;
  type: "regular_stage" | "playoff";
  start_date?: string | null;
  round_interval_days?: number;
  /** Dates sent by hand (Y-m-d per match); when absent they come from start and interval */
  round_dates?: string[];
  /** Matches of each round (1 or 2); absent means one each */
  round_legs?: (1 | 2)[];
  /** False when the backend locks the playoff; absent means editable */
  editable?: boolean;
  sources?: {
    kind?: "range" | "best_of_position";
    source_group_id?: number;
    position_start: number;
    position_end: number;
    best_count?: number;
  }[];
}

export interface GroupsApiOptions {
  groups?: MockGroup[];
  teams?: MockGroupTeam[];
}

export interface GroupsApi {
  /** Bodies of every write so far, as `[method, path, body]` */
  writes: [string, string, unknown][];
}

/**
 * Stubs `/leagues/1/tournaments/{id}/groups` (and the registrations list that
 * shows each team's group) over one in-memory tournament: the rules the
 * backend enforces that the screens depend on (unique names, power-of-2
 * playoffs, delete restrictions, balanced random assignment) work like the real thing.
 */
export async function mockGroupsApi(
  page: Page,
  {
    groups = [{ id: 1, name: "Fase regular", type: "regular_stage" }],
    teams = [],
  }: GroupsApiOptions = {},
): Promise<GroupsApi> {
  const api: GroupsApi = { writes: [] };
  // Copies: a test that moves a team must not change the fixtures the next one reads
  const state = {
    groups: groups.map((group) => ({ ...group })),
    teams: teams.map((team) => ({ ...team })),
    nextId: 100,
  };
  const regular = () => state.groups.filter((g) => g.type === "regular_stage");
  const countOf = (s: NonNullable<MockGroup["sources"]>[number]) =>
    s.kind === "best_of_position"
      ? (s.best_count ?? 0)
      : s.position_end - s.position_start + 1;
  const totalOf = (group: MockGroup) =>
    (group.sources ?? []).reduce((sum, s) => sum + countOf(s), 0);
  const ROUND_NAMES: Record<number, string> = {
    2: "Final",
    4: "Semifinal",
    8: "Cuartos de final",
    16: "Octavos de final",
  };
  const legsOf = (group: MockGroup): (1 | 2)[] => {
    const rounds = Math.log2(totalOf(group));

    return group.round_legs?.length === rounds
      ? group.round_legs
      : Array.from({ length: rounds }, (): 1 | 2 => 1);
  };
  /** One date per match, first round to the final */
  const roundDates = (group: MockGroup): (string | null)[] => {
    const matches = legsOf(group).reduce<number>((sum, legs) => sum + legs, 0);

    if (group.round_dates?.length === matches) {
      return group.round_dates;
    }

    return Array.from({ length: matches }, (_, index) => {
      if (!group.start_date) {
        return null;
      }

      const date = new Date(`${group.start_date}T00:00:00Z`);
      date.setUTCDate(
        date.getUTCDate() + (group.round_interval_days ?? 7) * index,
      );

      return date.toISOString().slice(0, 10);
    });
  };
  const finalDate = (group: MockGroup) => roundDates(group).at(-1) ?? null;
  const teamJson = (team: MockGroupTeam) => ({
    id: team.id,
    team: {
      id: team.id * 10,
      name: team.name,
      logo_url: null,
      status: "active",
      manager: team.manager ? { name: team.manager, pending: false } : null,
    },
  });
  const groupJson = (group: MockGroup) => {
    const base = {
      id: group.id,
      name: group.name,
      type: group.type,
      teams_count: state.teams.filter((t) => t.groupId === group.id).length,
    };

    if (group.type === "regular_stage") {
      return base;
    }

    const total = totalOf(group);

    return {
      ...base,
      start_date: group.start_date ?? null,
      round_interval_days: group.round_interval_days ?? 7,
      sources: (group.sources ?? []).map((s, i) => ({
        id: group.id * 10 + i,
        kind: "range",
        source_group_id: null,
        ...s,
        source_group_name:
          state.groups.find((g) => g.id === s.source_group_id)?.name ?? null,
        position: s.kind === "best_of_position" ? s.position_start : null,
        best_count: s.best_count ?? null,
      })),
      total_teams: total,
      rounds: Math.log2(total),
      round_dates: roundDates(group),
      ...(group.editable !== undefined && { editable: group.editable }),
      round_legs: legsOf(group),
      rounds_detail: (() => {
        const dates = roundDates(group);
        const legs = legsOf(group);
        let offset = 0;

        return legs.map((count, index) => {
          const detail = {
            name: ROUND_NAMES[2 ** (legs.length - index)] ?? "Ronda",
            legs: count,
            dates: dates.slice(offset, offset + count),
          };
          offset += count;

          return detail;
        });
      })(),
      final_date: finalDate(group),
    };
  };
  const overview = () => {
    const finals = new Set(
      state.groups
        .filter((g) => g.type === "playoff")
        .map(finalDate)
        .filter(Boolean),
    );

    return {
      groups: [
        ...regular().map(groupJson),
        ...state.groups.filter((g) => g.type === "playoff").map(groupJson),
      ],
      unassigned: state.teams.filter((t) => t.groupId === null).map(teamJson),
      finals_aligned: finals.size <= 1,
    };
  };
  const unprocessable = (error: unknown) => ({
    status: 422,
    json: { code: 422, error },
  });
  const normalize = (name: string) =>
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  await page.route(/\/tournaments\/\d+\/registrations(\?.*)?$/, (route) => {
    const data = state.teams.map((t) => ({
      id: t.id,
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      team: teamJson(t).team,
    }));

    return route.fulfill({
      json: {
        data,
        links: { first: null, last: "x", prev: null, next: null },
        meta: {
          currentPage: 1,
          from: 1,
          lastPage: 1,
          perPage: 5,
          to: data.length,
          total: data.length,
        },
        summary: { registered: data.length, banned: 0 },
      },
    });
  });

  await page.route(/\/tournaments\/\d+\/groups(\/.*)?(\?.*)?$/, (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.split("/groups")[1] ?? "";
    const body = request.postDataJSON() as Record<string, unknown> | null;

    if (method !== "GET") {
      api.writes.push([method, path || "/", body]);
    }

    if (method === "GET" && path === "") {
      return route.fulfill({ json: overview() });
    }

    if (method === "GET") {
      const group = state.groups.find((g) => `/${g.id}` === path);

      return route.fulfill({
        json: {
          ...groupJson(group as MockGroup),
          teams: state.teams
            .filter((t) => t.groupId === group?.id)
            .map(teamJson),
        },
      });
    }

    if (path === "/assignments") {
      for (const row of (
        body as {
          assignments: { registration_id: number; group_id: number | null }[];
        }
      ).assignments) {
        const team = state.teams.find((t) => t.id === row.registration_id);

        if (team) {
          team.groupId = row.group_id;
        }
      }

      return route.fulfill({ json: overview() });
    }

    if (path === "/random-assignment") {
      const targets = regular();
      state.teams.forEach((team, i) => {
        team.groupId = targets[i % targets.length].id;
      });

      return route.fulfill({ json: overview() });
    }

    if (method === "DELETE") {
      state.groups = state.groups.filter((g) => `/${g.id}` !== path);

      return route.fulfill({ status: 204 });
    }

    const current = state.groups.find((g) => `/${g.id}` === path);
    const name = String(body?.["name"] ?? current?.name ?? "");

    if (
      state.groups.some(
        (g) => g !== current && normalize(g.name) === normalize(name),
      )
    ) {
      return route.fulfill(
        unprocessable({
          name: ["Ya hay un grupo con ese nombre en este torneo."],
        }),
      );
    }

    const sources = body?.["sources"] as MockGroup["sources"];

    if (sources) {
      const total = sources.reduce((sum, s) => sum + countOf(s), 0);
      const overlaps = sources.some((a, i) =>
        sources.some(
          (b, j) =>
            i < j &&
            a.kind !== "best_of_position" &&
            b.kind !== "best_of_position" &&
            a.source_group_id === b.source_group_id &&
            a.position_start <= b.position_end &&
            b.position_start <= a.position_end,
        ),
      );

      if (overlaps) {
        return route.fulfill(
          unprocessable({
            "sources.1.position_start": [
              "Las posiciones se traslapan con otra fuente de la liguilla.",
            ],
          }),
        );
      }

      if (total < 2 || (total & (total - 1)) !== 0) {
        return route.fulfill(
          unprocessable({
            sources: [`El total de equipos (${total}) no es potencia de 2.`],
          }),
        );
      }
    }

    if (current) {
      Object.assign(current, {
        name,
        ...(body?.["start_date"] !== undefined && {
          start_date: body["start_date"],
        }),
        ...(body?.["round_interval_days"] !== undefined && {
          round_interval_days: body["round_interval_days"],
        }),
        round_dates: body?.["round_dates"] as string[] | undefined,
        round_legs: body?.["round_legs"] as (1 | 2)[] | undefined,
        ...(sources && { sources }),
      });

      return route.fulfill({ json: groupJson(current) });
    }

    const created: MockGroup = {
      id: state.nextId++,
      name,
      type: body?.["type"] === "playoff" ? "playoff" : "regular_stage",
      ...(body?.["type"] === "playoff" && {
        start_date: (body["start_date"] as string | null) ?? null,
        round_interval_days: (body["round_interval_days"] as number) ?? 7,
        round_dates: body["round_dates"] as string[] | undefined,
        round_legs: body["round_legs"] as (1 | 2)[] | undefined,
        sources,
      }),
    };
    state.groups.push(created);

    return route.fulfill({ status: 201, json: groupJson(created) });
  });

  return api;
}

export interface MockScheduleGroup {
  id: number;
  name: string;
  teams: string[];
}

export interface MatchesApiOptions {
  groups?: MockScheduleGroup[];
  /** 1 or 2 rounds, as the tournament has them */
  rounds?: 1 | 2;
  /** Start with a calendar already generated */
  generated?: boolean;
  /** The first match is already played (2 - 1): the calendar is frozen */
  played?: boolean;
  /** Refuses every write with this 422 message */
  refuse?: string;
  /** Tiebreakers the standings report, in order */
  criteria?: string[];
}

export interface MatchesApi {
  /** `[method, path, body]` of every write so far */
  writes: [string, string, unknown][];
}

interface MockMatch {
  id: number;
  group_id: number;
  group_name: string;
  matchday: number;
  round_number: number;
  phase: string;
  status: "scheduled" | "played";
  match_datetime: string | null;
  home: Record<string, unknown>;
  away: Record<string, unknown>;
  home_id: number;
  away_id: number;
  home_score: number | null;
  away_score: number | null;
}

/**
 * Stubs `/leagues/1/tournaments/{id}/matches` and `/standings` over one
 * in-memory tournament: a real round-robin per group (matchdays, rests, second
 * round), results that become played matches, and tables computed from them
 * (points, goal difference, goals for) with ties and manual order.
 */
export async function mockMatchesApi(
  page: Page,
  {
    groups = [
      { id: 1, name: "Grupo A", teams: ["Águilas", "Búhos", "Cóndores"] },
    ],
    rounds = 1,
    generated = false,
    played = false,
    refuse,
    criteria = ["points", "goal_difference", "goals_for"],
  }: MatchesApiOptions = {},
): Promise<MatchesApi> {
  const api: MatchesApi = { writes: [] };
  let nextId = 1;
  let matches: MockMatch[] = [];
  const manual = new Map<number, number[]>();

  const side = (group: MockScheduleGroup, id: number) => ({
    registration_id: id,
    team_id: id * 10,
    team_name: group.teams[id - 1],
    logo_url: null,
  });
  const build = (group: MockScheduleGroup): MockMatch[] => {
    // Circle method; an odd number gets a bye (null) so one team rests each day
    const ids: (number | null)[] = group.teams.map((_, i) => i + 1);

    if (ids.length % 2 === 1) {
      ids.push(null);
    }

    const result: MockMatch[] = [];
    let matchday = 0;

    for (let round = 1; round <= rounds; round++) {
      const ring = [...ids];

      for (let d = 0; d < ids.length - 1; d++) {
        matchday++;

        for (let i = 0; i < ring.length / 2; i++) {
          const first = ring[i];
          const second = ring[ring.length - 1 - i];

          if (first !== null && second !== null) {
            const [home, away] =
              round === 2 ? [second, first] : [first, second];
            result.push({
              id: nextId++,
              group_id: group.id,
              group_name: group.name,
              matchday,
              round_number: round,
              phase: "regular_stage",
              status: "scheduled",
              match_datetime: null,
              home: side(group, home),
              away: side(group, away),
              home_id: home,
              away_id: away,
              home_score: null,
              away_score: null,
            });
          }
        }

        ring.splice(1, 0, ring.pop() as number | null);
      }
    }

    return result;
  };
  const generate = () => {
    nextId = 1;
    matches = groups.flatMap(build);
  };
  const strip = ({ home_id, away_id, ...match }: MockMatch) => {
    void home_id;
    void away_id;

    return match;
  };

  if (generated) {
    generate();

    if (played) {
      matches[0].status = "played";
      matches[0].home_score = 2;
      matches[0].away_score = 1;
    }
  }

  const schedule = () => ({
    generated: matches.length > 0,
    groups: groups.map((group) => {
      const own = matches.filter((m) => m.group_id === group.id);
      const days = [...new Set(own.map((m) => m.matchday))];

      return {
        group_id: group.id,
        group_name: group.name,
        matchdays: days.map((day) => {
          const today = own.filter((m) => m.matchday === day);
          const busy = today.flatMap((m) => [m.home_id, m.away_id]);

          return {
            matchday: day,
            round_number: today[0].round_number,
            matches: today.map(strip),
            resting: group.teams
              .map((name, i) => ({ registration_id: i + 1, team_name: name }))
              .filter((team) => !busy.includes(team.registration_id)),
          };
        }),
      };
    }),
  });

  const standings = () => ({
    groups: groups.map((group) => {
      const stats = group.teams.map((name, i) => ({
        position: 0,
        registration_id: i + 1,
        team_id: (i + 1) * 10,
        team_name: name,
        logo_url: null,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
        tied: false,
      }));

      for (const m of matches.filter(
        (x) => x.group_id === group.id && x.status === "played",
      )) {
        const home = stats[m.home_id - 1];
        const away = stats[m.away_id - 1];
        const [hs, as] = [m.home_score as number, m.away_score as number];
        home.played++;
        away.played++;
        home.goals_for += hs;
        home.goals_against += as;
        away.goals_for += as;
        away.goals_against += hs;
        if (hs === as) {
          home.drawn++;
          away.drawn++;
          home.points++;
          away.points++;
        } else {
          const [winner, loser] = hs > as ? [home, away] : [away, home];
          winner.won++;
          winner.points += 3;
          loser.lost++;
        }
      }

      stats.forEach((row) => {
        row.goal_difference = row.goals_for - row.goals_against;
      });

      const key = (row: (typeof stats)[number]) =>
        `${row.points}|${row.goal_difference}|${row.goals_for}`;
      const sorted = [...stats].sort(
        (a, b) =>
          b.points - a.points ||
          b.goal_difference - a.goal_difference ||
          b.goals_for - a.goals_for ||
          a.registration_id - b.registration_id,
      );
      const order = manual.get(group.id);
      const ties: number[][] = [];
      const rows: typeof stats = [];

      for (let i = 0; i < sorted.length;) {
        let j = i;
        while (j + 1 < sorted.length && key(sorted[j + 1]) === key(sorted[i])) {
          j++;
        }

        let set = sorted.slice(i, j + 1);
        const resolved =
          set.length > 1 &&
          !!order &&
          set.every((r) => order.includes(r.registration_id));

        if (resolved) {
          set = [...set].sort(
            (a, b) =>
              (order as number[]).indexOf(a.registration_id) -
              (order as number[]).indexOf(b.registration_id),
          );
        } else if (set.length > 1) {
          ties.push(set.map((r) => r.registration_id));
        }

        set.forEach((row, index) => {
          row.position = resolved ? i + index + 1 : i + 1;
          row.tied = set.length > 1 && !resolved;
          rows.push(row);
        });
        i = j + 1;
      }

      return {
        group_id: group.id,
        group_name: group.name,
        criteria,
        rows,
        ties,
        has_manual_order: manual.has(group.id),
      };
    }),
  });

  const unprocessable = (message: string) => ({
    status: 422,
    json: { code: 422, error: message },
  });

  // The hours: a configuration with one play day and nothing outdated
  await page.route(/\/tournaments\/\d+\/schedule-config$/, (route) =>
    route.fulfill({
      json: {
        schedule_start_date: null,
        windows: [
          {
            weekday: 7,
            field: { id: 1, name: "Cancha 1" },
            start: "08:00",
            end: "13:00",
          },
        ],
        blocks: [],
        match_duration_minutes: 60,
      },
    }),
  );
  await page.route(/\/tournaments\/\d+\/schedule-config\/capacity$/, (route) =>
    route.fulfill({
      json: {
        weeks: [],
        matchdays: [],
        has_calendar: true,
        schedule_outdated: false,
      },
    }),
  );
  const proposal = {
    seed: 42,
    scheduled: 1,
    unscheduled: 1,
    locked_kept: 0,
    played_kept: 0,
    assigned_kept: 0,
    matchdays: [
      {
        matchday: 1,
        week_start: "2026-11-02",
        week_end: "2026-11-08",
        matches: 2,
        scheduled: 1,
        unscheduled: 1,
      },
    ],
    warnings: [
      {
        matchday: 1,
        unscheduled: 1,
        message: "Faltan 1 espacios en la jornada 1.",
      },
    ],
    matches: [
      {
        id: 1,
        matchday: 1,
        group: "Grupo A",
        home_team: "Águilas",
        away_team: "Búhos",
        match_datetime: "2026-11-07T08:00:00",
        field: { id: 1, name: "Cancha 1" },
      },
    ],
  };
  await page.route(/\/tournaments\/\d+\/schedule(\/.*)?$/, (route) => {
    const request = route.request();

    if (request.method() !== "GET") {
      api.writes.push([
        request.method(),
        new URL(request.url()).pathname,
        request.postDataJSON(),
      ]);
    }

    return route.fulfill({
      json: request.method() === "DELETE" ? { cleared: 3 } : proposal,
    });
  });
  await page.route(/\/tournaments\/\d+\/matches(\/.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace(/^.*\/matches/, "");

    if (method === "GET" && path === "/schedule") {
      return route.fulfill({ json: schedule() });
    }

    api.writes.push([method, path, request.postDataJSON() ?? null]);

    if (refuse) {
      return route.fulfill(unprocessable(refuse));
    }

    const result = /^\/(\d+)\/result$/.exec(path);

    if (result) {
      const found = matches.find((m) => m.id === Number(result[1]));

      if (!found) {
        return route.fulfill({ status: 404, json: { code: 404 } });
      }

      const body = request.postDataJSON() as {
        home_goals: number;
        away_goals: number;
      } | null;
      found.status = body ? "played" : "scheduled";
      found.home_score = body?.home_goals ?? null;
      found.away_score = body?.away_goals ?? null;

      return route.fulfill({ json: strip(found) });
    }

    if (method === "POST" && path === "/generate") {
      generate();

      return route.fulfill({
        json: {
          groups: groups.map((g) => ({
            group_id: g.id,
            group_name: g.name,
            teams: g.teams.length,
            matchdays: 0,
            matches: 0,
          })),
          total_matches: matches.length,
        },
      });
    }

    matches = [];

    return route.fulfill({ status: 204 });
  });

  await page.route(/\/tournaments\/\d+\/standings(\/.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === "GET") {
      return route.fulfill({ json: standings() });
    }

    api.writes.push([
      method,
      "/standings" + url.pathname.replace(/^.*\/standings/, ""),
      request.postDataJSON() ?? Object.fromEntries(url.searchParams),
    ]);

    if (refuse) {
      return route.fulfill(unprocessable(refuse));
    }

    if (method === "PUT") {
      const body = request.postDataJSON() as {
        group_id: number;
        registration_ids: number[];
      };
      manual.set(body.group_id, [
        ...(manual.get(body.group_id) ?? []),
        ...body.registration_ids,
      ]);

      return route.fulfill({ json: standings() });
    }

    manual.delete(Number(url.searchParams.get("group_id")));

    return route.fulfill({ status: 204 });
  });

  return api;
}

export interface PlayoffsApiOptions {
  /** Answer of `GET /close-regular-phase/preview` */
  preview?: unknown;
  /** Answer of `GET /playoffs` */
  bracket?: unknown;
  /** Answer of the preview once a best-of-position order was saved or removed (the backend recalculates it) */
  previewAfterOrder?: unknown;
  /** Refuses `POST /close-regular-phase` and result writes with this 422 message */
  refuse?: string;
}

export interface PlayoffsApi {
  /** `[method, path, body]` of every write so far (path after `/tournaments/{id}`) */
  writes: [string, string, unknown][];
}

/**
 * Stubs the closing of the regular phase and the playoff bracket
 * (`/close-regular-phase`, `/playoffs`) and the results of playoff matches with
 * fixed answers: what the screens do with the backend's data is tested, not
 * the bracket rules. Register it after `mockMatchesApi`, whose result route it
 * overrides.
 */
export async function mockPlayoffsApi(
  page: Page,
  { preview, bracket, previewAfterOrder, refuse }: PlayoffsApiOptions = {},
): Promise<PlayoffsApi> {
  const api: PlayoffsApi = { writes: [] };
  let ordered = false;

  await page.route(
    /\/tournaments\/\d+\/playoff-sources\/\d+\/manual-order$/,
    (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace(
        /^.*\/tournaments\/\d+/,
        "",
      );
      api.writes.push([request.method(), path, request.postDataJSON()]);

      if (refuse) {
        return route.fulfill({
          status: 422,
          json: { code: 422, error: refuse },
        });
      }

      ordered = request.method() === "PUT";

      return request.method() === "PUT"
        ? route.fulfill({ json: previewAfterOrder ?? preview })
        : route.fulfill({ status: 204 });
    },
  );

  await page.route(/\/tournaments\/\d+\/close-regular-phase/, (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(
      /^.*\/tournaments\/\d+/,
      "",
    );

    if (request.method() === "GET") {
      return route.fulfill({
        json: ordered ? (previewAfterOrder ?? preview) : preview,
      });
    }

    api.writes.push([request.method(), path, request.postDataJSON()]);

    return refuse
      ? route.fulfill({ status: 422, json: { code: 422, error: refuse } })
      : route.fulfill({ json: {} });
  });

  await page.route(/\/tournaments\/\d+\/playoffs$/, (route) =>
    route.fulfill({ json: bracket }),
  );

  await page.route(/\/tournaments\/\d+\/matches\/\d+\/result$/, (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(
      /^.*\/tournaments\/\d+/,
      "",
    );
    api.writes.push([request.method(), path, request.postDataJSON()]);

    return refuse
      ? route.fulfill({ status: 422, json: { code: 422, error: refuse } })
      : route.fulfill({ json: {} });
  });

  return api;
}
