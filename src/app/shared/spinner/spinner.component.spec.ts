import { ComponentFixture, TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";
import { SpinnerComponent } from "./spinner.component";

describe("SpinnerComponent", () => {
  function setup(size?: number): ComponentFixture<SpinnerComponent> {
    const fixture = TestBed.createComponent(SpinnerComponent);

    if (size !== undefined) {
      fixture.componentRef.setInput("size", size);
    }

    fixture.detectChanges();

    return fixture;
  }

  it("draws a 20px spinner by default", () => {
    const svg = setup().nativeElement.querySelector("svg");

    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("height")).toBe("20");
  });

  it("takes the size it is given", () => {
    const svg = setup(18).nativeElement.querySelector("svg");

    expect(svg.getAttribute("width")).toBe("18");
    expect(svg.getAttribute("height")).toBe("18");
  });

  it("is decorative and only rotates", () => {
    const svg = setup().nativeElement.querySelector("svg");

    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.classList).toContain("animate-spin");
    expect(svg.classList).toContain("motion-reduce:animate-none");
  });
});
