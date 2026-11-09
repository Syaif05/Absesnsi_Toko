import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { NextRequest } from "next/server";
import { AuthService } from "../../src/server/auth/service";
import { OwnerService } from "../../src/server/owner/service";
import { createOwnerHandler } from "../../src/server/owner/http";
import { cookieName } from "../../src/server/auth/http";
import type { AuthDatabase } from "../../src/server/auth/types";
import type { Store, Employee } from "../../src/server/owner/models";
const pg = new PGlite({ extensions: { btree_gist } });
const database: AuthDatabase = {
  transaction: (work) =>
    pg.transaction((tx) =>
      work({ query: (text, values) => tx.query(text, values) }),
    ),
};
const businessId = "b0000000-0000-4000-8000-000000000001";
const auth = new AuthService(database, businessId, "test-secret-".repeat(5));
const owner = new OwnerService(auth);
const handler = createOwnerHandler(() => ({
  owner,
  origin: "http://localhost:3000",
}));
let token = "",
  employeeToken = "",
  employee: Employee,
  first: Store,
  second: Store;
const storeInput = (code: string) => ({
  name: "Toko " + code,
  code,
  address: "Alamat fiktif",
  lat: -6.2,
  lng: 106.8,
  radiusM: 100,
  isActive: true,
  operatingHours: "08.00–20.00",
});
function req(
  method: string,
  body?: unknown,
  authToken = token,
  origin = "http://localhost:3000",
) {
  return new NextRequest("http://localhost:3000/api/v1/stores", {
    method,
    headers: {
      origin,
      "content-type": "application/json",
      cookie: cookieName + "=" + authToken,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
beforeAll(async () => {
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync("drizzle/" + file, "utf8"));
  await auth.bootstrap({
    code: "reza",
    password: "owner-password-for-test",
    fullName: "Owner Reza",
    businessName: "Absensi Kita",
  });
  token = (await auth.login("owner", "reza", "owner-password-for-test")).token;
}, 30000);
afterAll(() => pg.close());
it("owner can add a third store through the HTTP handler", async () => {
  for (const code of ["ONE", "TWO", "THREE"]) {
    const response = await handler(req("POST", storeInput(code)), "stores");
    expect(response.status).toBe(201);
  }
  const list = await owner.listStores(token);
  expect(list.items).toHaveLength(3);
  [first, second] = list.items;
  const fetched = await handler(req("GET"), "stores", first.id);
  expect(fetched.status).toBe(200);
  expect(fetched.headers.get("cache-control")).toBe("no-store");
});
it("store edits are scoped, validated and audited; duplicate codes return 409", async () => {
  const response = await handler(req("POST", storeInput("ONE")), "stores");
  expect(response.status).toBe(409);
  expect(
    (
      await handler(
        req("POST", { ...storeInput("INVALID"), lat: 91 }),
        "stores",
      )
    ).status,
  ).toBe(400);
  const changed = await owner.updateStore(token, first.id, {
    name: "Toko Baru",
    radiusM: 150,
  });
  expect(changed.radius_m).toBe(150);
  await expect(
    owner.updateStore(token, first.id, { isActive: false }),
  ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
  expect(
    (
      await pg.query("select * from attendance.audit_logs where entity_id=$1", [
        first.id,
      ])
    ).rows.length,
  ).toBeGreaterThan(1);
});
it("create employee generates a one-time hashed PIN and assignment history", async () => {
  const response = await handler(
    req("POST", {
      fullName: "Contoh Karyawan",
      code: "EMP-1",
      storeId: first.id,
      phone: "08123456789",
      joinedAt: "2026-11-09",
    }),
    "employees",
  );
  expect(response.status).toBe(201);
  const result = await response.json();
  employee = result.data.employee;
  expect(result.data.temporaryPin).toMatch(/^\d{6}$/);
  const credential = (
    await pg.query<{ pin_hash: string; must_change_pin: boolean }>(
      "select pin_hash,must_change_pin from attendance.employee_credentials where employee_id=$1",
      [employee.id],
    )
  ).rows[0];
  expect(credential.pin_hash).toContain("$argon2id$");
  expect(credential.must_change_pin).toBe(true);
  const firstLogin = await auth.login(
    "employee",
    "EMP-1",
    result.data.temporaryPin,
  );
  await auth.changePin(firstLogin.token, result.data.temporaryPin, "654321");
  employeeToken = (await auth.login("employee", "EMP-1", "654321")).token;
  expect(
    (
      await pg.query(
        "select * from attendance.employee_store_assignments where employee_id=$1",
        [employee.id],
      )
    ).rows,
  ).toHaveLength(1);
  const read = JSON.stringify(await owner.getEmployee(token, employee.id));
  expect(read).not.toContain("pin_hash");
  expect(read).not.toContain(result.data.temporaryPin);
  const audit = JSON.stringify(
    (
      await pg.query(
        "select metadata_redacted from attendance.audit_logs where entity_id=$1",
        [employee.id],
      )
    ).rows,
  );
  expect(audit).not.toContain("08123456789");
  expect(audit).not.toContain(result.data.temporaryPin);
});
it("employee cannot read owner lists or mutate stores/employees/settings", async () => {
  for (const resource of ["stores", "employees", "settings"] as const) {
    expect(
      (await handler(req("GET", undefined, employeeToken), resource)).status,
    ).toBe(403);
  }
  expect(
    (await handler(req("POST", storeInput("HACK"), employeeToken), "stores"))
      .status,
  ).toBe(403);
  expect(
    (
      await handler(
        req(
          "PATCH",
          { status: "inactive", confirmSensitive: true },
          employeeToken,
        ),
        "employees",
        employee.id,
      )
    ).status,
  ).toBe(403);
  expect(
    (await handler(req("PATCH", {}, employeeToken), "settings")).status,
  ).toBe(403);
});
it("ID changes preserve UUID and history but revoke active sessions", async () => {
  const before = await owner.getEmployee(token, employee.id);
  const changed = await owner.updateEmployee(token, employee.id, {
    code: "EMP-NEW",
    confirmSensitive: true,
  });
  expect(changed.id).toBe(before.id);
  await expect(auth.me(employeeToken)).rejects.toMatchObject({ status: 401 });
  employeeToken = (await auth.login("employee", "EMP-NEW", "654321")).token;
  expect(
    (
      await pg.query(
        "select * from attendance.employee_store_assignments where employee_id=$1",
        [employee.id],
      )
    ).rows,
  ).toHaveLength(1);
});
it("duplicate ID mutation rolls back, cross-business store and role injection are rejected", async () => {
  await owner.createEmployee(token, { fullName: "Contoh Dua", code: "EMP-2" });
  expect(
    (
      await handler(
        req("PATCH", { code: "EMP-2", confirmSensitive: true }),
        "employees",
        employee.id,
      )
    ).status,
  ).toBe(409);
  expect((await owner.getEmployee(token, employee.id)).employee_code).toBe(
    "EMP-NEW",
  );
  expect((await auth.me(employeeToken)).id).toBe(employee.id);
  await expect(
    owner.createEmployee(token, { fullName: "Escalation", role: "owner" }),
  ).rejects.toThrow();
  await expect(
    owner.createEmployee(token, {
      fullName: "Wrong store",
      storeId: "b0000000-0000-4000-8000-000000000099",
    }),
  ).rejects.toMatchObject({ code: "INVALID_STORE" });
});
it("moving stores closes assignments without destroying history", async () => {
  await owner.updateEmployee(token, employee.id, {
    storeId: second.id,
    confirmSensitive: true,
  });
  const rows = (
    await pg.query<{ ends_at: string | null }>(
      "select ends_at from attendance.employee_store_assignments where employee_id=$1 order by starts_at",
      [employee.id],
    )
  ).rows;
  expect(rows).toHaveLength(2);
  expect(rows[0].ends_at).not.toBeNull();
  expect(rows[1].ends_at).toBeNull();
});
it("deactivate/reactivate keeps employee history and revokes sessions", async () => {
  await owner.updateEmployee(token, employee.id, {
    status: "inactive",
    confirmSensitive: true,
  });
  await expect(auth.me(employeeToken)).rejects.toMatchObject({ status: 401 });
  await expect(
    auth.login("employee", "EMP-NEW", "654321"),
  ).rejects.toMatchObject({ status: 401 });
  await owner.updateEmployee(token, employee.id, {
    status: "active",
    confirmSensitive: true,
  });
  employeeToken = (await auth.login("employee", "EMP-NEW", "654321")).token;
  expect((await auth.me(employeeToken)).id).toBe(employee.id);
  expect(
    (await owner.listEmployees(token, { status: "inactive" })).items,
  ).toHaveLength(0);
});
it("store deactivate retains references and blocks new assignments", async () => {
  await owner.updateStore(token, second.id, {
    isActive: false,
    confirmSensitive: true,
  });
  expect((await owner.getStore(token, second.id)).is_active).toBe(false);
  expect((await owner.getEmployee(token, employee.id)).primary_store_id).toBe(
    second.id,
  );
  await expect(
    owner.createEmployee(token, { fullName: "No store", storeId: second.id }),
  ).rejects.toMatchObject({ code: "INVALID_STORE" });
  await owner.updateStore(token, second.id, {
    isActive: true,
    confirmSensitive: true,
  });
});
it("settings are versioned, whitelist validated and keep audit snapshots", async () => {
  const before = await owner.settings(token);
  const after = await owner.updateSettings(token, {
    ...before,
    businessName: "Usaha Baru",
    radiusM: 150,
    graceMinutes: 10,
  });
  expect(after.version).toBe(before.version + 1);
  await expect(owner.updateSettings(token, before)).rejects.toMatchObject({
    status: 409,
  });
  await expect(
    owner.updateSettings(token, { ...after, DATABASE_URL: "secret" }),
  ).rejects.toThrow();
  const history = (
    await pg.query<{
      metadata_redacted: {
        before: { radiusM: number };
        after: { radiusM: number };
      };
    }>(
      "select metadata_redacted from attendance.audit_logs where action='settings.update'",
    )
  ).rows[0].metadata_redacted;
  expect(history.before.radiusM).toBe(100);
  expect(history.after.radiusM).toBe(150);
});
it("CSRF, unauthenticated access and resources outside business are rejected", async () => {
  expect(
    (
      await handler(
        req("POST", storeInput("CSRF"), token, "https://evil.example"),
        "stores",
      )
    ).status,
  ).toBe(403);
  expect((await handler(req("GET", undefined, ""), "stores")).status).toBe(401);
  const other = new AuthService(
    database,
    "b0000000-0000-4000-8000-000000000002",
    "other-secret-".repeat(5),
  );
  await other.bootstrap({
    code: "owner2",
    password: "another-owner-password",
    fullName: "Other owner",
    businessName: "Other business",
  });
  const otherOwner = new OwnerService(other),
    otherToken = (
      await other.login("owner", "owner2", "another-owner-password")
    ).token;
  await expect(
    otherOwner.getEmployee(otherToken, employee.id),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    otherOwner.updateStore(otherToken, first.id, { name: "HACK" }),
  ).rejects.toMatchObject({ status: 404 });
  const missing = createOwnerHandler(() => {
    throw new Error("secret database");
  });
  const response = await missing(req("GET"), "stores");
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain(
    "secret database",
  );
});
it("failed audit rolls the business mutation back atomically", async () => {
  await pg.exec(
    "create function attendance.test_fail_audit() returns trigger language plpgsql as $$ begin if new.action='store.create' then raise exception 'test audit failure'; end if;return new;end $$;create trigger test_audit before insert on attendance.audit_logs for each row execute function attendance.test_fail_audit();",
  );
  try {
    await expect(
      owner.createStore(token, storeInput("ROLLBACK")),
    ).rejects.toThrow();
    expect(
      (await pg.query("select id from attendance.stores where code='ROLLBACK'"))
        .rows,
    ).toHaveLength(0);
  } finally {
    await pg.exec(
      "drop trigger test_audit on attendance.audit_logs;drop function attendance.test_fail_audit();",
    );
  }
});
