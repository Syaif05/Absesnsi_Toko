// Explicit, ephemeral browser QA only. Runtime application still uses the normal pg client.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { AuthService } from "../src/server/auth/service";
import { OwnerService } from "../src/server/owner/service";
import type { AuthDatabase } from "../src/server/auth/types";
if (
  process.env.NODE_ENV === "production" ||
  process.env.RUN_ISOLATED_PREVIEW !== "true" ||
  !process.env.PREVIEW_OWNER_PASSWORD
)
  throw new Error(
    "Explicit isolated QA opt-in and PREVIEW_OWNER_PASSWORD required",
  );
const db = new PGlite({ extensions: { btree_gist } });
await db.exec(readFileSync("supabase/sql/001_schema_all.sql", "utf8"));
const adapter: AuthDatabase = {
  transaction: (work) =>
    db.transaction((tx) =>
      work({ query: (text, values) => tx.query(text, values) }),
    ),
};
const businessId = "c0000000-0000-4000-8000-000000000001",
  secret = randomBytes(48).toString("hex");
const auth = new AuthService(adapter, businessId, secret);
await auth.bootstrap({
  code: "preview-owner",
  password: process.env.PREVIEW_OWNER_PASSWORD,
  fullName: "Owner Reza (TES)",
  businessName: "Usaha Princes (TES)",
});
const token = (
  await auth.login("owner", "preview-owner", process.env.PREVIEW_OWNER_PASSWORD)
).token;
const owner = new OwnerService(auth);
await owner.createStore(token, {
  name: "Princes Pusat (TES)",
  code: "PST",
  address: "Alamat fiktif Pusat",
  lat: -6.2,
  lng: 106.8,
});
await owner.createStore(token, {
  name: "Princes Timur (TES)",
  code: "TMR",
  address: "Alamat fiktif Timur",
  lat: -6.2,
  lng: 106.8,
});
await owner.createEmployee(token, {
  fullName: "Karyawan Contoh (TES)",
  code: "TES-001",
});
const socket = new PGLiteSocketServer({
  db,
  host: "127.0.0.1",
  port: 5544,
  maxConnections: 10,
});
await socket.start();
// Separate loopback-only fixture gateway, never a Next.js route or production endpoint.
// Supplies the already-authenticated test fixture for read-only viewport captures.
const gateway = createServer((request, response) => {
  if (request.method !== "GET" || !request.url?.startsWith("/owner-preview")) {
    response.writeHead(404);
    response.end();
    return;
  }
  const query = new URL(request.url, "http://127.0.0.1:3002").searchParams;
  const tab = query.get("tab");
  response.writeHead(302, {
    "Cache-Control": "no-store",
    "Set-Cookie":
      "princes-session=" + token + "; Path=/; HttpOnly; SameSite=Lax",
    Location:
      "http://127.0.0.1:3001/owner?tab=" +
      (["stores", "employees", "settings"].includes(tab ?? "")
        ? tab
        : "stores"),
  });
  response.end();
});
await new Promise<void>((resolve) =>
  gateway.listen(3002, "127.0.0.1", resolve),
);
const child = spawn(
  "pnpm",
  ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", "3001"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://postgres@127.0.0.1:5544/postgres",
      APP_BUSINESS_ID: businessId,
      SESSION_SECRET: secret,
      APP_BASE_URL: "http://127.0.0.1:3001",
      DATABASE_POOL_MAX: "1",
      ISOLATED_PREVIEW: "true",
    },
  },
);
let closing = false;
async function stop() {
  if (closing) return;
  closing = true;
  child.kill("SIGTERM");
  gateway.close();
  await socket.stop();
  await db.close();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
child.on("exit", () => void stop());
console.log("Isolated owner QA ready; all data disappear on shutdown.");
