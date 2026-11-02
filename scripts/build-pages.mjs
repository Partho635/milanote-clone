// Builds the GitHub Pages (static) version locally: `npm run build:pages` → ./out
// API routes are moved aside during the build and restored afterwards.
import { execSync } from "child_process";
import { existsSync, renameSync, writeFileSync } from "fs";

const api = "src/app/api", aside = ".api-aside";
const base = process.env.BASE_PATH ?? "/milanote-clone";
if (existsSync(api)) renameSync(api, aside);
try {
  execSync("npx next build", { stdio: "inherit", env: { ...process.env, STATIC_EXPORT: "1", BASE_PATH: base } });
  writeFileSync("out/.nojekyll", "");
} finally {
  if (existsSync(aside)) renameSync(aside, api);
}
