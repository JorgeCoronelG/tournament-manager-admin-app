import { inject, Service } from "@angular/core";
import {
  NavigationDropdown,
  NavigationItem,
  NavigationLink,
  NavigationSubheading,
} from "./navigation-item.interface";
import { Subject } from "rxjs";
import { NavigationLoaderService } from "./navigation-loader.service";

@Service()
export class NavigationService {
  private readonly navigationLoaderService = inject(NavigationLoaderService);

  readonly items = this.navigationLoaderService.items;

  private _openChangeSubject = new Subject<NavigationDropdown>();
  openChange$ = this._openChangeSubject.asObservable();

  triggerOpenChange(item: NavigationDropdown) {
    this._openChangeSubject.next(item);
  }

  isLink(item: NavigationItem): item is NavigationLink {
    return item.type === "link";
  }

  isDropdown(item: NavigationItem): item is NavigationDropdown {
    return item.type === "dropdown";
  }

  isSubheading(item: NavigationItem): item is NavigationSubheading {
    return item.type === "subheading";
  }
}
