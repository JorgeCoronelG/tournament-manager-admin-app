// Renames the project after cloning this base.
//
//   node scripts/init.mjs <name> ["Display Name"] [--dry-run]
//
//   name          npm/Angular project name: lowercase letters, digits and dashes
//   Display Name  shown in the browser title, sidenav and footer (defaults to a
//                 capitalised version of the name)
//
// It changes the project name (package.json, angular.json, Dockerfile, CI,
// README, lockfile) and the visible name. It does not touch the selector prefix
// (`app-`) or the `@ui` alias: those are conventions of the base.
import { readFileSync, writeFileSync } from "node:fs";

const OLD_NAME = "base-angular-dashboard";
const OLD_TITLE = "Base Dashboard";
const OLD_SIDENAV_TITLE = 'title: "Dashboard"';

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const [name, displayName] = args.filter((arg) => !arg.startsWith("--"));

if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error(
    'Usage: node scripts/init.mjs <name> ["Display Name"] [--dry-run]\n' +
      "  <name> must be lowercase letters, digits and dashes, starting with a letter.",
  );
  process.exit(1);
}

const title =
  displayName ??
  name
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

if (/["\\<>&]/.test(title)) {
  console.error('The display name must not contain " \\ < > or &.');
  process.exit(1);
}

/** file -> [[from, to], ...] */
const changes = {
  "package.json": [[OLD_NAME, name]],
  "package-lock.json": [[`"name": "${OLD_NAME}"`, `"name": "${name}"`]],
  "angular.json": [[OLD_NAME, name]],
  Dockerfile: [[OLD_NAME, name]],
  "scripts/prune-icons.mjs": [[OLD_NAME, name]],
  ".github/workflows/ci.yml": [[OLD_NAME, name]],
  "README.md": [
    [OLD_NAME, name],
    [OLD_TITLE, title],
  ],
  "src/index.html": [[OLD_TITLE, title]],
  "src/app/layouts/components/footer/footer.component.html": [
    [OLD_TITLE, title],
  ],
  "src/@ui/config/app-configs.ts": [[OLD_SIDENAV_TITLE, `title: "${title}"`]],
};

let touched = 0;

for (const [file, replacements] of Object.entries(changes)) {
  const before = readFileSync(file, "utf8");
  let after = before;

  for (const [from, to] of replacements) {
    after = after.split(from).join(to);
  }

  if (after !== before) {
    touched++;
    console.log(`${dryRun ? "would update" : "updated"}  ${file}`);

    if (!dryRun) {
      writeFileSync(file, after);
    }
  }
}

console.log(
  touched === 0
    ? "Nothing to do: the base names were already replaced."
    : `\n${dryRun ? "Would rename" : "Renamed"} the project to "${name}" (display name "${title}").`,
);

if (!dryRun && touched > 0) {
  console.log(
    "\nNext: review `git diff`, replace src/assets/img/logo/logo.svg and src/favicon.svg,\n" +
      "and remove the parts of the example (customers, mock/db.json) you do not need.",
  );
}
