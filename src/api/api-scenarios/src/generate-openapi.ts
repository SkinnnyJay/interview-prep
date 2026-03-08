/**
 * Generate OpenAPI (Swagger) JSON for the API Scenarios server.
 * Writes openapi.json to the project root. Run with: npm run openapi
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { buildServerForOpenAPI } from "./server";

async function main(): Promise<void> {
  const app = await buildServerForOpenAPI();
  await app.ready();
  const schema = app.swagger();
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
