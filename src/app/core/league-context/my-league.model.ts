/** A league the signed-in user can work in, as GET /my-leagues returns it */
export interface MyLeague {
  id: number;
  name: string;
  /** Only the superadmin receives inactive leagues; absent means active */
  status?: "active" | "inactive";
}
