import { TestBed } from "@angular/core/testing";
import { SettingsService } from "./settings.service";

describe("SettingsService", () => {
  let service: SettingsService;

  beforeEach(() => {
    service = TestBed.inject(SettingsService);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("uses the build-time environment by default", () => {
    expect(service.api("/customers")).toBe("http://api.test/customers");
  });

  it("lets config.json override the API url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ apiUrl: "https://api.example.com/" }),
      }),
    );

    await service.load();

    expect(service.apiUrl()).toBe("https://api.example.com");
    expect(service.api("/x")).toBe("https://api.example.com/x");
  });

  it("keeps the defaults when config.json is missing or invalid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await service.load();
    expect(service.apiUrl()).toBe("http://api.test");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    await service.load();
    expect(service.apiUrl()).toBe("http://api.test");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ apiUrl: 42 }) }),
    );
    await service.load();
    expect(service.apiUrl()).toBe("http://api.test");
  });
});
