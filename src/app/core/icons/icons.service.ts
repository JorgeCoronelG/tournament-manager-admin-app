import { inject, Service } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import {
  MatIconRegistry,
  SafeResourceUrlWithIconOptions,
} from "@angular/material/icon";

@Service()
export class IconsService {
  private readonly domSanitizer = inject(DomSanitizer);
  private readonly iconRegistry = inject(MatIconRegistry);

  constructor() {
    this.iconRegistry.addSvgIconResolver(
      (
        name: string,
        namespace: string,
      ): SafeResourceUrl | SafeResourceUrlWithIconOptions | null => {
        switch (namespace) {
          case "mat":
            return this.domSanitizer.bypassSecurityTrustResourceUrl(
              `assets/img/icons/material-design-icons/two-tone/${name}.svg`,
            );

          default:
            return null;
        }
      },
    );
  }
}
