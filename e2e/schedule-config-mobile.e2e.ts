import { expect, Locator, Page, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeFields,
  makeTournaments,
  mockFieldsApi,
  mockGroupsApi,
  mockMatchesApi,
  mockPlayoffsApi,
  mockTournamentsApi,
} from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

const TEAMS = ["Águilas", "Búhos", "Cóndores", "Delfines"];

const CONFIG = {
  schedule_start_date: "2026-12-01",
  windows: [1, 2].map((id) => ({
    weekday: 6,
    field: { id, name: `Cancha 0${id}` },
    start_time: "08:00",
    end_time: "12:00",
  })),
  blocks: [],
  match_duration_minutes: 60,
};

const CAPACITY = {
  weeks: [],
  has_calendar: true,
  schedule_outdated: false,
  locked_outside_schedule: 2,
  matchdays: [
    {
      matchday: 1,
      week: 1,
      start_date: "2026-12-05",
      end_date: "2026-12-06",
      matches_required: 4,
      slots_configured: 3,
      slots_available: 3,
      deficit: 1,
    },
    {
      matchday: 2,
      week: 2,
      start_date: "2026-12-12",
      end_date: "2026-12-13",
      matches_required: 2,
      slots_configured: 4,
      slots_available: 4,
      deficit: 0,
    },
  ],
};

const PLAYOFF_CAPACITY = {
  ...CAPACITY,
  matchdays: [],
  playoff_min_start_date: "2026-12-20",
  playoff_rounds: [
    {
      group_id: 10,
      group_name: "Oro",
      round_index: 1,
      round_name: "Semifinal",
      date: "2026-12-20",
      matches_required: 4,
      slots_available: 2,
      deficit: 2,
    },
  ],
  playoff_warnings: [{ message: "Faltan cupos en una ronda de la liguilla." }],
};

async function routes(page: Page, capacity: unknown) {
  const writes: unknown[] = [];

  await page.route(/\/tournaments\/\d+\/schedule-config$/, (route) => {
    const request = route.request();

    if (request.method() === "PUT") {
      writes.push(request.postDataJSON());

      return route.fulfill({ json: CONFIG });
    }

    return route.fulfill({ json: CONFIG });
  });
  await page.route(/\/tournaments\/\d+\/schedule-config\/capacity$/, (route) =>
    route.fulfill({ json: capacity }),
  );

  return writes;
}

/** The dialog finished its opening animation */
const settled = (page: Page) =>
  expect(page.locator(".mat-mdc-dialog-surface")).toHaveCSS(
    "transform",
    "none",
  );

async function openRegular(page: Page) {
  await freezeTime(page);
  await mockTournamentsApi(page, { tournaments: makeTournaments(4) });
  await mockGroupsApi(page, {
    groups: [{ id: 1, name: "Grupo A", type: "regular_stage" }],
    teams: TEAMS.map((name, i) => ({
      id: i + 1,
      name,
      manager: null,
      groupId: 1,
    })),
  });
  await mockFieldsApi(page, { fields: makeFields(2) });
  await mockMatchesApi(page, {
    groups: [{ id: 1, name: "Grupo A", teams: TEAMS }],
    generated: true,
  });
  const writes = await routes(page, CAPACITY);
  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: "Torneo 02" }).click();
  await page.getByRole("button", { name: "Configurar horarios" }).click();

  await settled(page);

  return { writes, dialog: page.locator("mat-dialog-container") };
}

async function openPlayoffs(page: Page) {
  await freezeTime(page);
  await mockTournamentsApi(page, {
    tournaments: makeTournaments(4).map((t) =>
      t.id === 4 ? { ...t, status: "playoffs" as const } : t,
    ),
  });
  await mockGroupsApi(page, {
    groups: [
      { id: 1, name: "Grupo A", type: "regular_stage" },
      {
        id: 10,
        name: "Oro",
        type: "playoff" as const,
        start_date: "2026-12-07",
        sources: [{ source_group_id: 1, position_start: 1, position_end: 4 }],
      },
    ],
    teams: TEAMS.map((name, i) => ({
      id: i + 1,
      name,
      manager: null,
      groupId: 1,
    })),
  });
  await mockFieldsApi(page, { fields: makeFields(2) });
  await mockMatchesApi(page, {
    groups: [{ id: 1, name: "Grupo A", teams: TEAMS }],
    generated: true,
  });
  await mockPlayoffsApi(page, { bracket: { playoffs: [] } });
  await routes(page, PLAYOFF_CAPACITY);
  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: "Torneo 04" }).click();
  await page.getByRole("tab", { name: "Liguilla" }).click();
  await page
    .getByRole("button", { name: "Configurar horarios de liguilla" })
    .click();

  await settled(page);

  return page.locator("mat-dialog-container");
}

/** The dialog's content does not scroll sideways */
const noSideScroll = async (dialog: Locator) =>
  expect(
    await dialog.evaluate((el) => {
      const content = el.querySelector<HTMLElement>("mat-dialog-content")!;

      return [el, content]
        .filter((node) => node.scrollWidth > node.clientWidth)
        .map((node) => node.tagName);
    }),
  ).toEqual([]);

const inside = async (
  page: Page,
  locator: Locator,
  viewport: { width: number; height: number },
) => {
  const box = (await locator.boundingBox())!;

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
};

for (const viewport of viewports) {
  test.describe(`schedule config on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });
    const tag = String(viewport.width);

    test("fills the screen with the buttons fixed at the bottom, half and half", async ({
      page,
    }) => {
      const { dialog } = await openRegular(page);
      const panel = page.locator(".mat-mdc-dialog-container");
      await expect(dialog).toBeVisible();
      const box = (await panel.boundingBox())!;
      expect(Math.round(box.width)).toBe(viewport.width);
      expect(Math.round(box.height)).toBe(viewport.height);
      expect(Math.round(box.x)).toBe(0);

      const cancel = dialog.getByRole("button", { name: "Cancelar" });
      const save = dialog.getByRole("button", { name: "Guardar" });
      await inside(page, cancel, viewport);
      await inside(page, save, viewport);
      const [c, s] = [
        (await cancel.boundingBox())!,
        (await save.boundingBox())!,
      ];
      expect(Math.abs(c.width - s.width)).toBeLessThan(2);
      expect(Math.abs(c.y - s.y)).toBeLessThan(2);

      // the content is the only thing that scrolls: the buttons stay in view after scrolling it
      await dialog
        .locator("mat-dialog-content")
        .evaluate((el) => el.scrollTo(0, 99999));
      await inside(page, save, viewport);
      await noSideScroll(dialog);
      await page.screenshot({ path: `test-results/config-botones-${tag}.png` });
    });

    test("shows the start and the duration, and opens the datepicker as a modal", async ({
      page,
    }) => {
      const { dialog } = await openRegular(page);

      await expect(dialog.getByText("Duración de los partidos:")).toBeVisible();
      await page.screenshot({ path: `test-results/config-inicio-${tag}.png` });

      await dialog.locator("mat-datepicker-toggle button").click();
      const picker = page.locator("mat-datepicker-content");
      await expect(picker).toBeVisible();
      await inside(page, picker, viewport);
      await page.screenshot({
        path: `test-results/config-datepicker-${tag}.png`,
      });
      await page.keyboard.press("Escape");
    });

    test("adds a day, edits it as a grid and removes it", async ({ page }) => {
      const { dialog } = await openRegular(page);

      await expect(
        dialog.getByText("Define los horarios generales de cada día"),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "Agregar día" }).click();
      await page.getByRole("menuitem", { name: "Lunes" }).click();

      const card = dialog
        .locator("div.rounded.border.p-3")
        .filter({ hasText: "Lunes" })
        .first();
      await expect(
        card.getByRole("button", { name: "Quitar día lunes" }),
      ).toBeVisible();
      const start = card.locator('input[placeholder="HH:mm"]').nth(0);
      const end = card.locator('input[placeholder="HH:mm"]').nth(1);
      await start.fill("09:00");
      await start.blur();
      await end.fill("13:00");
      await end.blur();

      const [s, e, fields] = await Promise.all([
        start.boundingBox(),
        end.boundingBox(),
        card.getByRole("combobox", { name: "Canchas" }).boundingBox(),
      ]);
      expect(Math.abs(s!.y - e!.y)).toBeLessThan(4);
      expect(e!.x).toBeGreaterThan(s!.x + s!.width - 1);
      expect(fields!.y).toBeGreaterThan(s!.y + s!.height - 1);
      expect(fields!.width).toBeGreaterThanOrEqual(viewport.width - 90);

      await card.getByRole("combobox", { name: "Canchas" }).click();
      await page.getByRole("option", { name: "Cancha 01" }).click();
      await page.keyboard.press("Escape");
      await noSideScroll(dialog);
      await page.screenshot({ path: `test-results/config-dia-${tag}.png` });

      await card.getByRole("button", { name: "Quitar día lunes" }).click();
      await expect(card).toHaveCount(0);
    });

    test("a field panel splits a window, flags the overlap and keeps the timepicker inside", async ({
      page,
    }) => {
      const { dialog } = await openRegular(page);
      const panel = dialog.locator("mat-expansion-panel").first();

      await expect(panel).toContainText("Cancha 01");
      await expect(
        panel.getByText("Restablecer al horario general del día"),
      ).toBeVisible();
      await panel.getByRole("button", { name: "Agregar franja" }).click();
      await expect(
        panel.getByRole("button", { name: "Quitar franja horaria" }),
      ).toHaveCount(2);

      const windows = panel.locator('input[placeholder="HH:mm"]');
      const first = (await windows.nth(0).boundingBox())!;
      const second = (await panel
        .locator('input[placeholder="HH:mm"]')
        .nth(1)
        .boundingBox())!;
      expect(Math.abs(first.y - second.y)).toBeLessThan(4);

      // overlap: the second window starts where the first one does
      await panel.locator('input[placeholder="HH:mm"]').nth(2).fill("08:00");
      await panel.locator('input[placeholder="HH:mm"]').nth(2).blur();
      await panel
        .locator('input[placeholder="HH:mm"]')
        .nth(3)
        .fill("11:00 a.m.");
      await panel.locator('input[placeholder="HH:mm"]').nth(3).blur();
      await expect(
        panel.getByText("se empalma con otro").first(),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/config-ventanas-${tag}.png`,
      });

      await panel
        .getByRole("button", { name: "Open timepicker options" })
        .first()
        .click();
      const options = page
        .locator("mat-timepicker-panel, .mat-timepicker-panel")
        .first();
      await expect(options).toBeVisible();
      await inside(page, options, viewport);
      await page.screenshot({
        path: `test-results/config-timepicker-${tag}.png`,
      });
      await page.keyboard.press("Escape");

      await panel
        .getByRole("button", { name: "Quitar franja horaria" })
        .first()
        .click();
      await expect(
        panel.getByRole("button", { name: "Quitar franja horaria" }),
      ).toHaveCount(0);
    });

    test("adds a block and removes it", async ({ page }) => {
      const { dialog } = await openRegular(page);

      await dialog.getByRole("button", { name: "Agregar bloqueo" }).click();
      const block = dialog
        .locator("mat-expansion-panel")
        .filter({ hasText: "Todo el día" })
        .last();
      await expect(
        block.getByRole("button", { name: "Quitar bloqueo" }),
      ).toBeVisible();
      await block.locator("mat-datepicker-toggle button").click();
      const picker = page.locator("mat-datepicker-content");
      await expect(picker).toBeVisible();
      await inside(page, picker, viewport);
      await page
        .locator("button.mat-calendar-body-cell:not([disabled])")
        .last()
        .click();
      await expect(picker).toHaveCount(0);
      // the "all day" hint is written once and does not run over the reason field
      const hint = block.getByText("Deja ambos horarios vacíos");
      await expect(hint).toHaveCount(1);
      const [h, reason] = await Promise.all([
        hint.boundingBox(),
        block.getByLabel("Motivo").boundingBox(),
      ]);
      expect(h!.y + h!.height).toBeLessThanOrEqual(reason!.y + 1);
      await noSideScroll(dialog);
      await page.screenshot({
        path: `test-results/config-bloqueos-${tag}.png`,
      });

      await block.getByRole("button", { name: "Quitar bloqueo" }).click();
      await expect(dialog.getByText("No hay fechas bloqueadas.")).toBeVisible();
    });

    test("calculates the capacity and shows a card per matchday", async ({
      page,
    }) => {
      const { dialog } = await openRegular(page);

      await expect(dialog.locator("table")).toHaveCount(0);
      const cards = dialog.locator("li").filter({ hasText: "Déficit" });
      await expect(cards).toHaveCount(2);
      await expect(cards.nth(0).locator("dd.text-amber-800")).toHaveText("1");
      await expect(cards.nth(1).locator("dd.text-green-800")).toHaveText("0");
      await expect(
        dialog.getByText("Estos partidos conservarán su horario"),
      ).toBeVisible();
      await noSideScroll(dialog);

      const calculate = dialog.getByRole("button", {
        name: "Calcular capacidad",
      });
      await expect(calculate).toBeVisible();
      await cards.first().scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/config-capacidad-${tag}.png`,
      });
    });

    test("saves with the buttons always in view, and cancels", async ({
      page,
    }) => {
      const { dialog, writes } = await openRegular(page);

      await dialog.getByRole("button", { name: "Guardar" }).click();
      await expect.poll(() => writes.length).toBe(1);
      await expect(dialog).toHaveCount(0);

      await page.getByRole("button", { name: "Configurar horarios" }).click();
      await page.getByRole("button", { name: "Cancelar" }).click();
      await expect(page.locator("mat-dialog-container")).toHaveCount(0);
    });

    test("the playoffs version lists a card per round", async ({ page }) => {
      const dialog = await openPlayoffs(page);

      await expect(dialog.getByText("Faltan cupos en una ronda")).toBeVisible();
      await expect(dialog.locator("table")).toHaveCount(0);
      const card = dialog.locator("li").filter({ hasText: "Déficit" });
      await expect(card).toHaveCount(1);
      await expect(card.locator("dd.text-amber-800")).toHaveText("2");
      await noSideScroll(dialog);
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/config-liguilla-${tag}.png`,
      });
    });
  });
}
