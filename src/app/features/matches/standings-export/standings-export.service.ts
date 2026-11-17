import {
  ApplicationRef,
  createComponent,
  EnvironmentInjector,
  inject,
  Service,
} from "@angular/core";
import { toBlob } from "html-to-image";
import {
  SHIELD_IMAGE,
  StandingsImageComponent,
} from "./standings-image.component";
import { exportFileName, StandingsImageData } from "./standings-image.model";

/** What happened to the image: `cancelled` when the user closed the share menu */
export type ExportOutcome = "shared" | "downloaded" | "cancelled";

const IMAGE_TIMEOUT = 8000;

/** Draws the standings picture out of view and turns it into a PNG to share or download */
@Service()
export class StandingsExportService {
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);

  /** A phone or tablet whose share menu takes files (a desktop browser downloads instead) */
  readonly canShareFiles: boolean = (() => {
    try {
      return (
        typeof navigator.canShare === "function" &&
        window.matchMedia("(pointer: coarse)").matches &&
        navigator.canShare({
          files: [new File([""], "a.png", { type: "image/png" })],
        })
      );
    } catch {
      return false;
    }
  })();

  async export(
    data: StandingsImageData,
    tournamentName: string,
    groupName: string | null,
  ): Promise<ExportOutcome> {
    const blob = await this.render(data);
    const fileName = exportFileName(tournamentName, groupName, new Date());

    if (this.canShareFiles) {
      const file = new File([blob], fileName, { type: "image/png" });

      try {
        await navigator.share({ files: [file], title: tournamentName });

        return "shared";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return "cancelled";
        }
        // The browser refused to share (e.g. the gesture is too old): download it instead
      }
    }

    this.download(blob, fileName);

    return "downloaded";
  }

  /** Mounts the picture out of view, waits for fonts and shields, and takes it as a PNG */
  private async render(data: StandingsImageData): Promise<Blob> {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.style.cssText =
      "position:fixed;left:-10000px;top:0;pointer-events:none;";
    document.body.append(wrapper);

    const host = document.createElement("div");
    wrapper.append(host);

    const ref = createComponent(StandingsImageComponent, {
      environmentInjector: this.injector,
      hostElement: host,
    });

    try {
      ref.setInput("data", data);
      this.appRef.attachView(ref.hostView);
      ref.changeDetectorRef.detectChanges();

      await document.fonts?.ready;
      await this.imagesLoaded(host);

      const blob = await toBlob(host, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        // A shield that cannot be fetched (CORS) is replaced instead of stopping the export
        imagePlaceholder: SHIELD_IMAGE,
      });

      if (!blob) {
        throw new Error("The image could not be generated");
      }

      return blob;
    } finally {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
      wrapper.remove();
    }
  }

  /** Waits for every shield; one that fails is swapped for the generic one */
  private imagesLoaded(host: HTMLElement): Promise<unknown> {
    const loads = [...host.querySelectorAll("img")].map(
      (img) =>
        new Promise<void>((resolve) => {
          const done = () => resolve();
          const fail = () => {
            img.onerror = null;
            img.onload = done;
            img.src = SHIELD_IMAGE;
          };

          if (img.complete) {
            return img.naturalWidth > 0 ? done() : fail();
          }

          img.onload = done;
          img.onerror = fail;
        }),
    );

    return Promise.race([
      Promise.all(loads),
      new Promise((resolve) => setTimeout(resolve, IMAGE_TIMEOUT)),
    ]);
  }

  private download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
