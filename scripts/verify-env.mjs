import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const errors = [];
const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const timezone = process.env.APP_TIMEZONE ?? "Asia/Jakarta";

try {
  const url = new URL(baseUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error();
} catch {
  errors.push("APP_BASE_URL harus URL HTTP/HTTPS yang valid.");
}

try {
  new Intl.DateTimeFormat("id-ID", { timeZone: timezone });
} catch {
  errors.push("APP_TIMEZONE tidak dikenali.");
}

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
      throw new Error();
    }
  } catch {
    errors.push("DATABASE_URL harus URL PostgreSQL yang valid.");
  }
}

if (process.env.STORAGE_DRIVER && process.env.STORAGE_DRIVER !== "supabase") {
  errors.push("STORAGE_DRIVER yang direncanakan adalah supabase.");
}

if (errors.length) {
  for (const error of errors) console.error(`ENV: ${error}`);
  process.exitCode = 1;
} else {
  console.log("ENV nonsecret valid.");
  console.log(`Database: ${databaseUrl ? "URL terisi; jalankan db:check" : "belum dikonfigurasi"}.`);
  console.log("Secret, storage, dan bootstrap belum diuji pada Fase 0.");
}
