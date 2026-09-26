import { TestBed } from "@angular/core/testing";
import { MatDialogRef } from "@angular/material/dialog";
import { of } from "rxjs";
import { provideTestI18n } from "../../../testing/i18n";
import { CustomerFormDialogComponent } from "./customer-form-dialog.component";
import { CustomersApi } from "./customers.api";

describe("CustomerFormDialogComponent", () => {
  const create = vi.fn();
  const close = vi.fn();

  beforeEach(() => {
    create.mockReset().mockReturnValue(of({ id: 1 }));
    close.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: CustomersApi, useValue: { create } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
  });

  it("does not submit an invalid form", async () => {
    const fixture = TestBed.createComponent(CustomerFormDialogComponent);
    fixture.detectChanges();

    await fixture.componentInstance.save();

    expect(create).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.customerForm.name().invalid()).toBe(true);
  });

  it("creates the customer and closes the dialog with the result", async () => {
    const fixture = TestBed.createComponent(CustomerFormDialogComponent);
    const { customerForm } = fixture.componentInstance;
    fixture.detectChanges();

    customerForm.name().value.set("Ada Lovelace");
    customerForm.email().value.set("ada@example.com");
    await fixture.componentInstance.save();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ada Lovelace",
        email: "ada@example.com",
      }),
    );
    expect(close).toHaveBeenCalledWith({ id: 1 });
  });

  it("rejects an invalid email", () => {
    const fixture = TestBed.createComponent(CustomerFormDialogComponent);
    const { customerForm } = fixture.componentInstance;

    customerForm.name().value.set("Ada");
    customerForm.email().value.set("not-an-email");

    expect(customerForm.email().invalid()).toBe(true);
  });
});
