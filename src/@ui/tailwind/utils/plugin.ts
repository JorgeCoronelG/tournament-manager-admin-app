import tailwindPlugin from "tailwindcss/plugin";

// Tailwind 4 loads tailwind.config.ts through jiti, which wraps this CommonJS
// default export once more: `{ default: plugin }` instead of `plugin`.
export const plugin: typeof tailwindPlugin =
  (tailwindPlugin as unknown as { default?: typeof tailwindPlugin }).default ??
  tailwindPlugin;
