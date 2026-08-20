/**
 * AL1D5 CLI entry — loads TypeScript orchestration via Vite SSR.
 *
 * Run from web/:
 *   node tools/governed_alias_append_dry_run_cli.mjs --source-aliases ... --accepted-candidates ... --out-dir ... --expected-bundle-id ... --primary-keys ... --dictionary-ir-ids ...
 *
 * Or: npm run alias:append-dry-run -- --source-aliases ...
 */

import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const server = await createServer({
  root,
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const mod = await server.ssrLoadModule(
    "/src/aliases/governed_alias_append_cli_dry_run.ts",
  );
  const code = await mod.main(process.argv.slice(2));
  await server.close();
  process.exit(typeof code === "number" ? code : 1);
} catch (err) {
  console.error(err);
  await server.close();
  process.exit(1);
}
