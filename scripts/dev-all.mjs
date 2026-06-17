import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { startEmbeddedPostgres } from "./dev-db.mjs";

const port = Number(process.env.PGPORT || 5432);
const host = process.env.PGHOST || "127.0.0.1";
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");

async function portIsOpen() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

const pg = (await portIsOpen()) ? null : await startEmbeddedPostgres();

if (!pg) {
  console.log(`PostgreSQL already listening on ${host}:${port}`);
}

const next = spawn(process.execPath, [nextBin, "dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@127.0.0.1:5432/outreach_os?schema=public",
  },
});

async function shutdown(signal) {
  if (next.exitCode === null) {
    next.kill(signal);
  }

  if (pg) {
    await pg.stop();
  }

  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

next.on("exit", async (code) => {
  if (pg) {
    await pg.stop();
  }

  process.exit(code || 0);
});
