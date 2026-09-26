import { RendererFactory2, DOCUMENT, inject, Service } from "@angular/core";
import { Platform } from "@angular/cdk/platform";

@Service()
export class AppPlatformService {
  private document = inject<Document>(DOCUMENT);
  private readonly rendererFactory2 = inject(RendererFactory2);
  private readonly platform = inject(Platform);

  constructor() {
    const renderer = this.rendererFactory2.createRenderer(null, null);

    if (this.platform.BLINK) {
      renderer.addClass(this.document.body, "is-blink");
    }
  }
}
