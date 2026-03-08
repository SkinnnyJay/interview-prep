/**
 * Generate OpenAPI JSON for the Autocomplete API.
 * Writes openapi.json to the project root. Run with: npm run openapi
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { createApp } from "./server";

async function main(): Promise<void> {
  const app = await createApp();
  await app.ready();
  const schema = (app as { swagger: () => unknown }).swagger();
  const outPath = join(process.cwd(), "openapi.json");
  writeFileSync(outPath, JSON.stringify(schema, null, 2), "utf-8");
  await app.close();
  console.log(`OpenAPI spec written to ${outPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
