import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createServer, LogLevel } from "pglite-server";

const port = Number(process.env.PGLITE_PORT || 5432);
const host = process.env.PGLITE_HOST || "127.0.0.1";
const dataDir = path.join(process.cwd(), "storage", "pglite");

await mkdir(dataDir, { recursive: true });

const db = new PGlite(dataDir);
await db.waitReady;

const server = createServer(db, { logLevel: LogLevel.Warn });

server.listen(port, host, () => {
  console.log(`Local Postgres-compatible dev DB listening on ${host}:${port}`);
  console.log(`Data directory: ${dataDir}`);
});

function shutdown() {
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
