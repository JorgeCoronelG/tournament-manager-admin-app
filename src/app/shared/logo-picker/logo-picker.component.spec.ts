import { TestBed } from "@angular/core/testing";
import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { provideTestI18n } from "../../../testing/i18n";
import { LOGO_MAX_BYTES } from "./logo-validation";
import { LogoPickerComponent } from "./logo-picker.component";

function pick(root: HTMLElement, file: File): void {
  const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", {
    value: { item: () => file },
    configurable: true,
  });
  input.dispatchEvent(new Event("change"));
}

describe("LogoPickerComponent", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
    TestBed.configureTestingModule({ providers: [provideTestI18n()] });
    for (const icon of ["shield", "cloud_upload"]) {
      TestBed.inject(MatIconRegistry).addSvgIconLiteralInNamespace(
        "mat",
        icon,
        TestBed.inject(DomSanitizer).bypassSecurityTrustHtml("<svg></svg>"),
      );
    }
  });

  function setup(currentUrl: string | null = null) {
    const fixture = TestBed.createComponent(LogoPickerComponent);
    fixture.componentRef.setInput("currentUrl", currentUrl);
    fixture.detectChanges();

    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it("labels the file input and accepts only JPG, PNG and WebP", () => {
    const { root } = setup();
    const input = root.querySelector<HTMLInputElement>("input[type=file]")!;

    expect(input.accept).toBe("image/jpeg,image/png,image/webp");
    expect(root.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
  });

  it("takes a valid image and previews it", () => {
    const { fixture, root } = setup();
    const file = new File(["x"], "a.png", { type: "image/png" });

    pick(root, file);
    fixture.detectChanges();

    expect(fixture.componentInstance.file()).toBe(file);
    expect(root.querySelector("img")?.getAttribute("src")).toBe("blob:preview");
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it("rejects another type with a message", () => {
    const { fixture, root } = setup();

    pick(root, new File(["x"], "a.gif", { type: "image/gif" }));
    fixture.detectChanges();

    expect(fixture.componentInstance.file()).toBeNull();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      "JPG, PNG o WebP",
    );
  });

  it("rejects an image over 2 MB with a message", () => {
    const { fixture, root } = setup();
    const big = new File(["x"], "a.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: LOGO_MAX_BYTES + 1 });

    pick(root, big);
    fixture.detectChanges();

    expect(fixture.componentInstance.file()).toBeNull();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain("2 MB");
  });

  it("removes the chosen image, or marks the current one as removed", () => {
    const { fixture, root } = setup("http://x/logo.png");
    const component = fixture.componentInstance;
    expect(root.querySelector("img")?.getAttribute("src")).toBe(
      "http://x/logo.png",
    );

    pick(root, new File(["x"], "a.png", { type: "image/png" }));
    fixture.detectChanges();
    root
      .querySelectorAll("button")[1]
      .dispatchEvent(new Event("click", { bubbles: true }));
    fixture.detectChanges();

    expect(component.file()).toBeNull();
    expect(component.removed()).toBe(true);
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelectorAll("button")).toHaveLength(1);
  });

  function drop(root: HTMLElement, file: File): void {
    const zone = root.querySelector("div")!;
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      value: { files: { item: () => file } },
    });
    zone.dispatchEvent(event);
  }

  it("takes an image dropped on the zone", () => {
    const { fixture, root } = setup();
    const file = new File(["x"], "a.png", { type: "image/png" });

    drop(root, file);
    fixture.detectChanges();

    expect(fixture.componentInstance.file()).toBe(file);
    expect(root.querySelector("img")?.getAttribute("src")).toBe("blob:preview");
  });

  it("rejects a dropped file of another type", () => {
    const { fixture, root } = setup();

    drop(root, new File(["x"], "a.gif", { type: "image/gif" }));
    fixture.detectChanges();

    expect(fixture.componentInstance.file()).toBeNull();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });
});
