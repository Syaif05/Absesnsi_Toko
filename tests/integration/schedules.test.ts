import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { NextRequest } from "next/server";
import { AuthService } from "../../src/server/auth/service";
import { OwnerService } from "../../src/server/owner/service";
import { ScheduleService } from "../../src/server/schedules/service";
import { createScheduleHandler } from "../../src/server/schedules/http";
import { cookieName } from "../../src/server/auth/http";
import { shiftInstants } from "../../src/server/schedules/time";
import type { AuthDatabase } from "../../src/server/auth/types";
import type { Store, Employee } from "../../src/server/owner/models";
import type {
  ShiftTemplate,
  ScheduledShift,
} from "../../src/server/schedules/models";
const pg = new PGlite({ extensions: { btree_gist } }),
  businessId = "f0000000-0000-4000-8000-000000000001";
const db: AuthDatabase = {
  transaction: (work) =>
    pg.transaction((tx) =>
      work({ query: (text, values) => tx.query(text, values) }),
    ),
};
const auth = new AuthService(db, businessId, "schedule-test-secret-".repeat(3)),
  owner = new OwnerService(auth),
  service = new ScheduleService(auth),
  handler = createScheduleHandler(() => ({
    schedules: service,
    origin: "http://localhost:3000",
  }));
let token = "",
  employeeToken = "",
  employee: Employee,
  stores: Store[],
  template: ShiftTemplate,
  night: ScheduledShift;
const input = () => ({
  employeeId: employee.id,
  storeId: stores[1].id,
  templateId: template.id,
  date: "2026-11-09",
  startTime: "20:00",
  endTime: "05:00",
  crossesMidnight: true,
});
function req(method: string, body?: unknown, session = token, query = "") {
  return new NextRequest("http://localhost:3000/api/v1/schedules" + query, {
    method,
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      cookie: cookieName + "=" + session,
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
    code: "owner",
    password: "owner-password-for-test",
    fullName: "Owner Tes",
    businessName: "Usaha Tes",
  });
  token = (await auth.login("owner", "owner", "owner-password-for-test")).token;
  for (const code of ["PST", "TMR"])
    await owner.createStore(token, {
      code,
      name: code,
      address: "Alamat tes",
      lat: -6.2,
      lng: 106.8,
    });
  stores = (await owner.listStores(token)).items;
  const created = await owner.createEmployee(token, {
    fullName: "Karyawan Tes",
    code: "SCH-1",
    storeId: stores[0].id,
  });
  employee = created.employee;
  const first = await auth.login("employee", "SCH-1", created.temporaryPin);
  await auth.changePin(first.token, created.temporaryPin, "654321");
  employeeToken = (await auth.login("employee", "SCH-1", "654321")).token;
}, 30000);
afterAll(() => pg.close());
it("calculates 20:00–05:00 in Jakarta, Makassar and Jayapura", () => {
  for (const [timezone, hour] of [
    ["Asia/Jakarta", "13"],
    ["Asia/Makassar", "12"],
    ["Asia/Jayapura", "11"],
  ]) {
    const t = shiftInstants("2026-11-09", "20:00", "05:00", true, timezone);
    expect(t.startsAt).toBe("2026-11-09T" + hour + ":00:00.000Z");
    expect((Date.parse(t.endsAt) - Date.parse(t.startsAt)) / 3600000).toBe(9);
  }
  expect(() =>
    shiftInstants("2026-11-09", "20:00", "05:00", false, "Asia/Jakarta"),
  ).toThrow();
  expect(() =>
    shiftInstants("2026-11-09", "08:00", "16:00", true, "Asia/Jakarta"),
  ).toThrow();
});
it("creates template and cross-store draft without moving employee home store", async () => {
  template = await service.saveTemplate(token, {
    name: "Malam",
    startTime: "20:00",
    endTime: "05:00",
    crossesMidnight: true,
    graceMinutes: 7,
    isActive: true,
  });
  const response = await handler(req("POST", input()), "schedules");
  expect(response.status).toBe(201);
  night = (await response.json()).data;
  expect(night.status).toBe("draft");
  expect((await handler(req("GET"), "schedules", night.id)).status).toBe(200);
  expect((await handler(req("GET"), "templates", template.id)).status).toBe(
    200,
  );
  expect(night.ends_at).toContain("22:00");
  expect((await owner.getEmployee(token, employee.id)).primary_store_id).toBe(
    stores[0].id,
  );
  expect(
    (await service.own(employeeToken, { from: "2026-11-09", to: "2026-11-16" }))
      .items,
  ).toHaveLength(0);
});
it("publishes with snapshot; employee only sees own published assignments", async () => {
  night = await service.decide(token, night.id, {
    status: "published",
    version: night.version,
    confirmed: true,
  });
  expect(night.rule_snapshot.grace_minutes).toBe(7);
  expect(night.rule_snapshot.radius_m).toBe(100);
  const own = await service.own(employeeToken, {
    from: "2026-11-09",
    to: "2026-11-16",
  });
  expect(own.items).toHaveLength(1);
  expect(own.items[0].employee_id).toBe(employee.id);
  await expect(
    service.own(employeeToken, {
      from: "2026-11-09",
      to: "2026-11-16",
      employeeId: "other",
    }),
  ).rejects.toThrow();
});
it("overlapping draft is allowed but publish/update returns 409 and rolls back", async () => {
  const draft = await service.create(token, {
    ...input(),
    templateId: null,
    startTime: "21:00",
    endTime: "06:00",
  });
  const response = await handler(
    req("PATCH", {
      status: "published",
      version: draft.version,
      confirmed: true,
    }),
    "schedules",
    draft.id,
  );
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe("SCHEDULE_OVERLAP");
  const unchanged = (
    await service.list(token, { from: "2026-11-09", to: "2026-11-16" })
  ).items.find((r) => r.id === draft.id)!;
  expect(unchanged.status).toBe("draft");
  expect(unchanged.version).toBe(1);
  expect(
    (
      await pg.query(
        "select * from attendance.audit_logs where entity_id=$1 and action='schedule.published'",
        [draft.id],
      )
    ).rows,
  ).toHaveLength(0);
});
it("adjacent overnight shift is valid and week boundary includes previous-day continuation", async () => {
  const adjacent = await service.create(token, {
    ...input(),
    templateId: null,
    date: "2026-11-10",
    startTime: "05:00",
    endTime: "08:00",
    crossesMidnight: false,
  });
  await service.decide(token, adjacent.id, {
    status: "published",
    version: 1,
    confirmed: true,
  });
  const boundary = await service.own(employeeToken, {
    from: "2026-11-10",
    to: "2026-11-11",
  });
  expect(boundary.items.some((r) => r.id === night.id)).toBe(true);
});
it("template/store rule edits do not mutate published snapshot or event-free shift times", async () => {
  await service.saveTemplate(
    token,
    {
      name: "Malam baru",
      startTime: "19:00",
      endTime: "04:00",
      crossesMidnight: true,
      graceMinutes: 20,
      isActive: true,
      version: template.version,
    },
    template.id,
  );
  await owner.updateStore(token, stores[1].id, { radiusM: 200 });
  const saved = (
    await service.list(token, { from: "2026-11-09", to: "2026-11-16" })
  ).items.find((r) => r.id === night.id)!;
  expect(saved.rule_snapshot.grace_minutes).toBe(7);
  expect(saved.rule_snapshot.radius_m).toBe(100);
  expect(saved.starts_at).toContain("13:00");
});
it("attendance requires confirmation; original session remains and identity cannot change", async () => {
  await pg.query(
    "insert into attendance.attendance_sessions(employee_id,schedule_id,check_in_at) values($1,$2,$3)",
    [employee.id, night.id, night.starts_at],
  );
  await expect(
    service.update(token, night.id, {
      ...input(),
      version: night.version,
      startTime: "19:30",
    }),
  ).rejects.toMatchObject({ code: "ATTENDANCE_CONFIRMATION_REQUIRED" });
  await expect(
    service.update(token, night.id, {
      ...input(),
      storeId: stores[0].id,
      version: night.version,
      confirmWithAttendance: true,
    }),
  ).rejects.toMatchObject({ code: "ATTENDANCE_IDENTITY_LOCKED" });
  night = await service.update(token, night.id, {
    ...input(),
    version: night.version,
    startTime: "19:30",
    confirmWithAttendance: true,
  });
  expect(night.rule_snapshot.grace_minutes).toBe(7);
  expect(
    (
      await pg.query(
        "select check_in_at from attendance.attendance_sessions where schedule_id=$1",
        [night.id],
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await pg.query(
        "select metadata_redacted from attendance.audit_logs where entity_id=$1 and action='schedule.update'",
        [night.id],
      )
    ).rows,
  ).toHaveLength(1);
});
it("stale versions and invalid transitions are rejected, cancellation preserves history", async () => {
  await expect(
    service.decide(token, night.id, {
      status: "cancelled",
      version: 1,
      confirmed: true,
      confirmWithAttendance: true,
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    service.decide(token, night.id, {
      status: "cancelled",
      version: night.version,
      confirmed: true,
    }),
  ).rejects.toMatchObject({ code: "ATTENDANCE_CONFIRMATION_REQUIRED" });
  night = await service.decide(token, night.id, {
    status: "cancelled",
    version: night.version,
    confirmed: true,
    confirmWithAttendance: true,
  });
  await expect(
    service.decide(token, night.id, {
      status: "published",
      version: night.version,
      confirmed: true,
    }),
  ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  expect(
    (
      await pg.query(
        "select * from attendance.attendance_sessions where schedule_id=$1",
        [night.id],
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (await service.own(employeeToken, { from: "2026-11-09", to: "2026-11-10" }))
      .items,
  ).toHaveLength(0);
});
it("employee cannot administer schedules/templates and CSRF is rejected", async () => {
  expect(
    (await handler(req("POST", input(), employeeToken), "schedules")).status,
  ).toBe(403);
  expect(
    (await handler(req("GET", undefined, employeeToken), "templates")).status,
  ).toBe(403);
  expect(
    (
      await handler(
        new NextRequest("http://localhost:3000/api/v1/schedules", {
          method: "POST",
          headers: {
            origin: "https://evil.example",
            "content-type": "application/json",
            cookie: cookieName + "=" + token,
          },
          body: JSON.stringify(input()),
        }),
        "schedules",
      )
    ).status,
  ).toBe(403);
});
it("cross-business targets and inactive templates are rejected", async () => {
  await expect(
    service.create(token, {
      ...input(),
      storeId: "f0000000-0000-4000-8000-000000000099",
    }),
  ).rejects.toMatchObject({ code: "INVALID_ASSIGNMENT" });
  await service.saveTemplate(
    token,
    {
      name: "Nonaktif",
      startTime: "20:00",
      endTime: "05:00",
      crossesMidnight: true,
      graceMinutes: 20,
      isActive: false,
      version: 2,
    },
    template.id,
  );
  await expect(service.create(token, input())).rejects.toMatchObject({
    code: "INVALID_TEMPLATE",
  });
  await expect(
    service.saveTemplate(
      token,
      {
        name: "Tidak boleh aktif otomatis",
        startTime: "20:00",
        endTime: "05:00",
        crossesMidnight: true,
        graceMinutes: 20,
        version: 3,
      },
      template.id,
    ),
  ).rejects.toThrow();
  await expect(
    service.list(token, { from: "2026-11-09", to: "2027-01-01" }),
  ).rejects.toMatchObject({ code: "INVALID_RANGE" });
});
it("published historical time remains editable after employee deactivation", async () => {
  const value = {
    ...input(),
    templateId: null,
    date: "2026-11-12",
    startTime: "21:00",
  };
  let record = await service.create(token, value);
  record = await service.decide(token, record.id, {
    status: "published",
    version: record.version,
    confirmed: true,
  });
  await owner.updateEmployee(token, employee.id, {
    status: "inactive",
    confirmSensitive: true,
  });
  const changed = await service.update(token, record.id, {
    ...value,
    startTime: "21:30",
    version: record.version,
    confirmWithAttendance: false,
  });
  expect(changed.starts_at).toContain("14:30");
  expect(changed.rule_snapshot).toEqual(record.rule_snapshot);
});
it("changing business timezone never reinterprets an existing draft local clock", async () => {
  await owner.updateEmployee(token, employee.id, {
    status: "active",
    confirmSensitive: true,
  });
  const value = {
    ...input(),
    templateId: null,
    date: "2026-11-14",
    startTime: "08:00",
    endTime: "16:00",
    crossesMidnight: false,
  };
  let record = await service.create(token, value);
  const old = record.starts_at;
  const settings = await owner.settings(token);
  await owner.updateSettings(token, { ...settings, timezone: "Asia/Makassar" });
  record = await service.update(token, record.id, {
    ...value,
    version: record.version,
  });
  expect(record.starts_at).toBe(old);
  record = await service.decide(token, record.id, {
    status: "published",
    version: record.version,
    confirmed: true,
  });
  expect(record.starts_at).toBe(old);
  expect(record.rule_snapshot.timezone).toBe("Asia/Jakarta");
});
