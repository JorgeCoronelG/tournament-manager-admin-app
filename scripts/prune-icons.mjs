// Removes the Material icons that the app never references from the production
// build (the package ships ~2,500 icons per style and only a few are used).
//
// An icon counts as used when its `mat:<name>` id appears anywhere in `src/`.
// Icons whose names are built at runtime or come from a backend must be listed
// in KEEP.
import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const KEEP = [];
const SRC = "src";
const ICONS_DIR =
  "dist/base-angular-dashboard/browser/assets/img/icons/material-design-icons/two-tone";

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (/\.(ts|html|scss|json)$/.test(entry)) {
      yield path;
    }
  }
}

const used = new Set(KEEP);
for (const file of walk(SRC)) {
  for (const [, name] of readFileSync(file, "utf8").matchAll(
    /mat:([a-z0-9_]+)/g,
  )) {
    used.add(name);
  }
}

let removed = 0;
for (const file of readdirSync(ICONS_DIR)) {
  if (file.endsWith(".svg") && !used.has(file.slice(0, -4))) {
    rmSync(join(ICONS_DIR, file));
    removed++;
  }
}

console.log(
  `prune-icons: kept ${used.size} referenced icons, removed ${removed} unused`,
);
