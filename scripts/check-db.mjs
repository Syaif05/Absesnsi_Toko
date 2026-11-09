import { existsSync } from "node:fs";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL belum diisi di .env.local.");
  process.exit(1);
}

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });

try {
  await client.connect();
  const result = await client.query("select current_database() as database, version() as version");
  console.log(`Database terhubung: ${result.rows[0].database}`);
  console.log(`Engine: ${result.rows[0].version.split(" ")[0]}`);
} catch (error) {
  console.error(`Koneksi database gagal: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
