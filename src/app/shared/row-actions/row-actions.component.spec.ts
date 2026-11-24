import { TestBed } from "@angular/core/testing";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { provideTestI18n } from "../../../testing/i18n";
import { RowAction, RowActionsComponent } from "./row-actions.component";

describe("RowActionsComponent", () => {
  async function open(actions: RowAction[]) {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
      ],
    });
    const fixture = TestBed.createComponent(RowActionsComponent);
    fixture.componentRef.setInput("actions", actions);
    fixture.componentRef.setInput("labelKey", "users.actions.menu");
    fixture.detectChanges();

    fixture.nativeElement.querySelector("button").click();
    fixture.detectChanges();
    await fixture.whenStable();

    return document.querySelector(".mat-mdc-menu-panel") as HTMLElement;
  }

  const action = (
    labelKey: string,
    extra: Partial<RowAction> = {},
  ): RowAction => ({
    icon: "mat:edit",
    labelKey,
    run: vi.fn(),
    ...extra,
  });

  it("draws no divider when no action asks for one", async () => {
    const panel = await open([
      action("users.actions.edit"),
      action("users.actions.delete", { danger: true }),
    ]);

    expect(panel.querySelectorAll("mat-divider")).toHaveLength(0);
    expect(panel.querySelectorAll("[mat-menu-item]")).toHaveLength(2);
    expect(
      panel.querySelector(".app-action-danger-item")?.textContent?.trim(),
    ).toBe("Eliminar");
  });

  it("draws a divider before the action that asks for it", async () => {
    const panel = await open([
      action("users.actions.edit"),
      action("users.actions.activate", { divider: true }),
      action("users.actions.delete"),
    ]);

    const children = Array.from(
      panel.querySelectorAll("mat-divider, [mat-menu-item]"),
    ).map((el) =>
      el.tagName === "MAT-DIVIDER" ? "|" : el.textContent?.trim(),
    );

    expect(children).toEqual(["Editar", "|", "Activar", "Eliminar"]);
  });

  it("does not draw a divider before the first action", async () => {
    const panel = await open([
      action("users.actions.edit", { divider: true }),
      action("users.actions.delete"),
    ]);

    expect(panel.querySelectorAll("mat-divider")).toHaveLength(0);
  });

  it("runs the action that is clicked", async () => {
    const run = vi.fn();
    const panel = await open([action("users.actions.edit", { run })]);

    (panel.querySelector("[mat-menu-item]") as HTMLElement).click();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not disable nor add a hint to an action that sets neither", async () => {
    const panel = await open([action("users.actions.edit")]);
    const item = panel.querySelector("[mat-menu-item]") as HTMLButtonElement;

    expect(item.disabled).toBe(false);
    expect(item.getAttribute("aria-disabled")).not.toBe("true");
    expect(item.querySelector(".text-xs")).toBeNull();
  });

  it("shows the hint under the label and does not run a disabled action", async () => {
    const run = vi.fn();
    const panel = await open([
      action("users.actions.edit", { disabled: true, hint: "Sin cupo", run }),
    ]);
    const item = panel.querySelector("[mat-menu-item]") as HTMLButtonElement;

    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(item.querySelector(".text-xs")?.textContent?.trim()).toBe(
      "Sin cupo",
    );
    item.click();
    expect(run).not.toHaveBeenCalled();
  });
});
