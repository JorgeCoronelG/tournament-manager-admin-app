import { TestBed } from "@angular/core/testing";
import { AppLayoutService } from "./app-layout.service";

describe("AppLayoutService", () => {
  let service: AppLayoutService;

  beforeEach(() => {
    service = TestBed.inject(AppLayoutService);
  });

  it("opens and closes the sidenav", () => {
    expect(service.sidenavOpen()).toBe(false);

    service.openSidenav();
    expect(service.sidenavOpen()).toBe(true);

    service.closeSidenav();
    expect(service.sidenavOpen()).toBe(false);
  });

  it("collapses and expands the sidenav", () => {
    service.collapseSidenav();
    expect(service.sidenavCollapsed()).toBe(true);

    service.expandSidenav();
    expect(service.sidenavCollapsed()).toBe(false);
  });

  it("toggles the search overlay", () => {
    service.openSearch();
    expect(service.searchOpen()).toBe(true);

    service.closeSearch();
    expect(service.searchOpen()).toBe(false);
  });
});
