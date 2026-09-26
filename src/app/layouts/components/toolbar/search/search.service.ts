import { Service, signal } from "@angular/core";
import { Subject } from "rxjs";

@Service()
export class SearchService {
  readonly value = signal("");
  readonly isOpen = signal(false);

  readonly submitSubject = new Subject<string>();
  readonly submit$ = this.submitSubject.asObservable();
}
