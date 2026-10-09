import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { AuthApi } from "./auth.api";

describe("AuthApi", () => {
  it("identifies the web panel as the client when logging in", () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const controller = TestBed.inject(HttpTestingController);

    TestBed.inject(AuthApi).login("ada@example.com", "secret").subscribe();

    const request = controller.expectOne((r) => r.url.endsWith("/login"));
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual({
      email: "ada@example.com",
      password: "secret",
      client: "web",
    });
    controller.verify();
  });
});
