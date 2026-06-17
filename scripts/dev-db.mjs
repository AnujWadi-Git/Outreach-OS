import { access } from "node:fs/promises";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const port = Number(process.env.PGPORT || 5432);
const host = process.env.PGHOST || "127.0.0.1";
const user = process.env.PGUSER || "postgres";
const password = process.env.PGPASSWORD || "postgres";
const database = process.env.PGDATABASE || "outreach_os";
const databaseDir = path.join(process.cwd(), "storage", "embedded-postgres");

export function createEmbeddedPostgres() {
  return new EmbeddedPostgres({
    databaseDir,
    user,
    password,
    port,
    persistent: true,
    onLog: (message) => {
      const text = String(message).trim();
      if (text && /ready to accept connections|listening on|database system/.test(text)) {
        console.log(text);
      }
    },
    onError: (message) => {
      const text = String(message).trim();
      if (text) console.error(text);
    },
  });
}

async function isInitialised() {
  try {
    await access(path.join(databaseDir, "PG_VERSION"));
    return true;
  } catch {
    return false;
  }
}

async function ensureDatabase(pg) {
  const client = pg.getPgClient("postgres", host);
  await client.connect();

  try {
    const result = await client.query(
      "select 1 from pg_database where datname = $1",
      [database]
    );

    if (result.rowCount === 0) {
      await client.query(`create database "${database.replaceAll('"', '""')}"`);
      console.log(`Created database ${database}`);
    }
  } finally {
    await client.end();
  }
}

export async function startEmbeddedPostgres() {
  const pg = createEmbeddedPostgres();

  if (!(await isInitialised())) {
    console.log("Initialising embedded PostgreSQL...");
    await pg.initialise();
  }

  await pg.start();
  await ensureDatabase(pg);

  console.log(`Embedded PostgreSQL listening on ${host}:${port}`);
  console.log(`Data directory: ${databaseDir}`);

  return pg;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pg = await startEmbeddedPostgres();

  async function shutdown() {
    await pg.stop();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
