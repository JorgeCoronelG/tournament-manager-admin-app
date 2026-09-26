import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { firstValueFrom } from "rxjs";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import {
  email,
  form,
  FormField,
  required,
  submit,
} from "@angular/forms/signals";
import { TranslocoPipe } from "@jsverse/transloco";
import { CustomersApi } from "./customers.api";
import { Customer, NewCustomer } from "./customer.model";

@Component({
  selector: "app-customer-form-dialog",
  templateUrl: "./customer-form-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TranslocoPipe,
  ],
})
export class CustomerFormDialogComponent {
  private readonly api = inject(CustomersApi);
  private readonly dialogRef =
    inject<MatDialogRef<CustomerFormDialogComponent, Customer>>(MatDialogRef);

  private readonly model = signal<NewCustomer>({
    name: "",
    email: "",
    company: "",
    country: "",
    status: "active",
  });

  readonly customerForm = form(this.model, (customer) => {
    required(customer.name);
    required(customer.email);
    email(customer.email);
  });

  readonly saving = signal(false);

  save(): Promise<boolean> {
    return submit(this.customerForm, async () => {
      this.saving.set(true);

      try {
        this.dialogRef.close(
          await firstValueFrom(this.api.create(this.model())),
        );
      } catch {
        // The error interceptor already told the user; keep the dialog open
      } finally {
        this.saving.set(false);
      }

      return undefined;
    });
  }
}
