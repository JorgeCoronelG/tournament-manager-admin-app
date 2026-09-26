// Starts the mock API on http://localhost:3000 with the data in mock/db.json.
// Works on a copy, so changes made through the API never touch the repository.
import { copyFileSync, mkdtempSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(mkdtempSync(join(tmpdir(), "mock-api-")), "db.json");
copyFileSync("mock/db.json", db);

spawn("npx", ["--yes", "json-server@0.17.4", "--port", "3000", db], {
  stdio: "inherit",
});
