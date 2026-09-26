export type CustomerStatus = "active" | "inactive";

export interface Customer {
  id: number;
  name: string;
  email: string;
  company: string;
  country: string;
  status: CustomerStatus;
  /** ISO 8601 date */
  createdAt: string;
}

export type NewCustomer = Omit<Customer, "id" | "createdAt">;

export interface CustomersQuery {
  /** Zero-based page index */
  page: number;
  pageSize: number;
  search: string;
  status: CustomerStatus | "";
  sort: keyof Customer;
  order: "asc" | "desc";
}
