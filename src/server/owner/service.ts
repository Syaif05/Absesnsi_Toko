import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AuthError, type SqlConnection, type Identity } from "../auth/types";
import { AuthService } from "../auth/service";
import { hashCredential, temporaryPin } from "../auth/crypto";
import {
  createStoreSchema,
  patchStoreSchema,
  createEmployeeSchema,
  patchEmployeeSchema,
  settingsSchema,
  listSchema,
} from "./validation";
import type { Store, Employee, BusinessSettings, Page } from "./models";
const storeColumns =
  "id,code,name,address,lat,lng,radius_m,is_active,operating_hours";
const employeeColumns =
  "id,employee_code,full_name,primary_store_id,status,phone,joined_at,role";
const notFound = () => new AuthError("NOT_FOUND", 404, "Data tidak ditemukan.");
function redact(value: unknown) {
  if (value && typeof value === "object" && "phone" in value)
    return { ...value, phone: value.phone ? "[redacted]" : null };
  return value;
}
async function audit(
  c: SqlConnection,
  actor: Identity,
  action: string,
  entity: string,
  id: string,
  before: unknown,
  after: unknown,
) {
  await c.query(
    "insert into attendance.audit_logs(actor_id,action,entity_type,entity_id,metadata_redacted) values($1,$2,$3,$4,$5)",
    [
      actor.id,
      action,
      entity,
      id,
      JSON.stringify({ before: redact(before), after: redact(after) }),
    ],
  );
}
function sensitive(confirmed: boolean | undefined) {
  if (!confirmed)
    throw new AuthError(
      "CONFIRMATION_REQUIRED",
      400,
      "Konfirmasikan perubahan sensitif terlebih dahulu.",
    );
}
async function storeForAssignment(
  c: SqlConnection,
  businessId: string,
  storeId: string | null,
) {
  if (
    storeId &&
    !(
      await c.query(
        "select id from attendance.stores where id=$1 and business_id=$2 and is_active=true for update",
        [storeId, businessId],
      )
    ).rows.length
  )
    throw new AuthError(
      "INVALID_STORE",
      400,
      "Pilih toko aktif dari usaha ini.",
    );
}
async function assignment(
  c: SqlConnection,
  employeeId: string,
  storeId: string | null,
) {
  await c.query(
    "update attendance.employee_store_assignments set ends_at=now() where employee_id=$1 and ends_at is null",
    [employeeId],
  );
  if (storeId)
    await c.query(
      "insert into attendance.employee_store_assignments(employee_id,store_id,starts_at) values($1,$2,now())",
      [employeeId, storeId],
    );
}
function page<T>(items: T[], offset: number): Page<T> {
  return {
    items: items.slice(0, 50),
    hasMore: items.length > 50,
    nextOffset: offset + 50,
  };
}
export class OwnerService {
  constructor(private auth: AuthService) {}
  listStores(token: string, params: unknown = {}) {
    return this.auth.withOwner(token, async (c, a) => {
      const p = listSchema.parse(params);
      const result = await c.query<Store>(
        `select ${storeColumns} from attendance.stores where business_id=$1 and (name ilike $2 or code ilike $2) and ($3::boolean is null or is_active=$3) order by created_at,id limit 51 offset $4`,
        [
          a.businessId,
          "%" + p.q + "%",
          p.status ? p.status === "active" : null,
          p.offset,
        ],
      );
      return page(result.rows, p.offset);
    });
  }
  getStore(token: string, id: string) {
    z.uuid().parse(id);
    return this.auth.withOwner(token, async (c, a) => {
      const row = (
        await c.query<Store>(
          `select ${storeColumns} from attendance.stores where id=$1 and business_id=$2`,
          [id, a.businessId],
        )
      ).rows[0];
      if (!row) throw notFound();
      return row;
    });
  }
  createStore(token: string, input: unknown) {
    return this.auth.withOwner(token, async (c, a) => {
      const d = createStoreSchema.parse(input);
      const id = randomUUID();
      const row = (
        await c.query<Store>(
          `insert into attendance.stores(id,business_id,code,name,address,lat,lng,radius_m,is_active,operating_hours) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning ${storeColumns}`,
          [
            id,
            a.businessId,
            d.code,
            d.name,
            d.address,
            d.lat,
            d.lng,
            d.radiusM,
            d.isActive,
            d.operatingHours,
          ],
        )
      ).rows[0];
      await audit(c, a, "store.create", "store", id, null, row);
      return row;
    });
  }
  updateStore(token: string, id: string, input: unknown) {
    z.uuid().parse(id);
    return this.auth.withOwner(token, async (c, a) => {
      const d = patchStoreSchema.parse(input);
      const old = (
        await c.query<Store>(
          `select ${storeColumns} from attendance.stores where id=$1 and business_id=$2 for update`,
          [id, a.businessId],
        )
      ).rows[0];
      if (!old) throw notFound();
      if (d.isActive !== undefined && d.isActive !== old.is_active)
        sensitive(d.confirmSensitive);
      const row = (
        await c.query<Store>(
          `update attendance.stores set code=$1,name=$2,address=$3,lat=$4,lng=$5,radius_m=$6,is_active=$7,operating_hours=$8 where id=$9 and business_id=$10 returning ${storeColumns}`,
          [
            d.code ?? old.code,
            d.name ?? old.name,
            d.address ?? old.address,
            d.lat ?? old.lat,
            d.lng ?? old.lng,
            d.radiusM ?? old.radius_m,
            d.isActive ?? old.is_active,
            d.operatingHours ?? old.operating_hours,
            id,
            a.businessId,
          ],
        )
      ).rows[0];
      await audit(c, a, "store.update", "store", id, old, row);
      return row;
    });
  }
  listEmployees(token: string, params: unknown = {}) {
    return this.auth.withOwner(token, async (c, a) => {
      const p = listSchema.parse(params);
      const rows = (
        await c.query<Employee>(
          `select ${employeeColumns} from attendance.employees where business_id=$1 and role='employee' and (full_name ilike $2 or employee_code ilike $2) and ($3::uuid is null or primary_store_id=$3) and ($4::text is null or status=$4) order by created_at,id limit 51 offset $5`,
          [
            a.businessId,
            "%" + p.q + "%",
            p.storeId ?? null,
            p.status ?? null,
            p.offset,
          ],
        )
      ).rows;
      return page(rows, p.offset);
    });
  }
  getEmployee(token: string, id: string) {
    z.uuid().parse(id);
    return this.auth.withOwner(token, async (c, a) => {
      const row = (
        await c.query<Employee>(
          `select ${employeeColumns} from attendance.employees where id=$1 and business_id=$2 and role='employee'`,
          [id, a.businessId],
        )
      ).rows[0];
      if (!row) throw notFound();
      return row;
    });
  }
  createEmployee(token: string, input: unknown) {
    return this.auth.withOwner(token, async (c, a) => {
      const d = createEmployeeSchema.parse(input);
      await storeForAssignment(c, a.businessId, d.storeId);
      const id = randomUUID(),
        pin = temporaryPin(),
        code = d.code ?? "PRS-" + randomUUID().slice(0, 8).toUpperCase();
      const row = (
        await c.query<Employee>(
          `insert into attendance.employees(id,business_id,employee_code,full_name,primary_store_id,status,phone,joined_at,role) values($1,$2,$3,$4,$5,$6,$7,$8,'employee') returning ${employeeColumns}`,
          [
            id,
            a.businessId,
            code,
            d.fullName,
            d.storeId,
            d.status,
            d.phone,
            d.joinedAt ? d.joinedAt + "T00:00:00+07:00" : null,
          ],
        )
      ).rows[0];
      await c.query(
        "insert into attendance.employee_credentials(employee_id,pin_hash,must_change_pin) values($1,$2,true)",
        [id, await hashCredential(pin)],
      );
      await assignment(c, id, d.storeId);
      await audit(c, a, "employee.create", "employee", id, null, row);
      return { employee: row, temporaryPin: pin };
    });
  }
  updateEmployee(token: string, id: string, input: unknown) {
    z.uuid().parse(id);
    return this.auth.withOwner(token, async (c, a) => {
      const d = patchEmployeeSchema.parse(input);
      const old = (
        await c.query<Employee>(
          `select ${employeeColumns} from attendance.employees where id=$1 and business_id=$2 and role='employee' for update`,
          [id, a.businessId],
        )
      ).rows[0];
      if (!old) throw notFound();
      const changeCode = d.code !== undefined && d.code !== old.employee_code,
        changeStatus = d.status !== undefined && d.status !== old.status,
        changeStore =
          d.storeId !== undefined && d.storeId !== old.primary_store_id;
      if (changeCode || changeStatus || changeStore)
        sensitive(d.confirmSensitive);
      if (changeStore) await storeForAssignment(c, a.businessId, d.storeId!);
      const row = (
        await c.query<Employee>(
          `update attendance.employees set employee_code=$1,full_name=$2,primary_store_id=$3,status=$4,phone=$5,joined_at=$6 where id=$7 and business_id=$8 returning ${employeeColumns}`,
          [
            d.code ?? old.employee_code,
            d.fullName ?? old.full_name,
            d.storeId === undefined ? old.primary_store_id : d.storeId,
            d.status ?? old.status,
            d.phone === undefined ? old.phone : d.phone,
            d.joinedAt === undefined
              ? old.joined_at
              : d.joinedAt
                ? d.joinedAt + "T00:00:00+07:00"
                : null,
            id,
            a.businessId,
          ],
        )
      ).rows[0];
      if (changeCode || changeStatus)
        await c.query(
          "update attendance.auth_sessions set revoked_at=now() where employee_id=$1 and revoked_at is null",
          [id],
        );
      if (changeStore) await assignment(c, id, d.storeId!);
      await audit(c, a, "employee.update", "employee", id, old, row);
      return row;
    });
  }
  private async readSettings(
    c: SqlConnection,
    businessId: string,
  ): Promise<BusinessSettings> {
    const business = (
      await c.query<{ name: string; timezone: string }>(
        "select name,timezone from attendance.businesses where id=$1",
        [businessId],
      )
    ).rows[0];
    const rows = (
      await c.query<{ key: string; value_json: Record<string, unknown> }>(
        "select key,value_json from attendance.business_settings where business_id=$1",
        [businessId],
      )
    ).rows;
    const rules =
      rows.find((r) => r.key === "attendance_rules")?.value_json ?? {};
    const brand = rows.find((r) => r.key === "branding")?.value_json ?? {};
    return {
      businessName: business.name,
      timezone: business.timezone,
      accent: typeof brand.accent === "string" ? brand.accent : "#8095f5",
      radiusM: Number(rules.radiusM ?? 100),
      accuracyM: Number(rules.accuracyM ?? 100),
      graceMinutes: Number(rules.graceMinutes ?? 5),
      version: Number(rules.version ?? 0),
    };
  }
  settings(token: string) {
    return this.auth.withOwner(token, (c, a) =>
      this.readSettings(c, a.businessId),
    );
  }
  updateSettings(token: string, input: unknown) {
    return this.auth.withOwner(token, async (c, a) => {
      const d = settingsSchema.parse(input);
      await c.query(
        "select id from attendance.businesses where id=$1 for update",
        [a.businessId],
      );
      const old = await this.readSettings(c, a.businessId);
      if (old.version !== d.version)
        throw new AuthError(
          "CONFLICT",
          409,
          "Pengaturan telah berubah. Muat ulang sebelum menyimpan.",
        );
      const next = { ...d, version: old.version + 1 };
      await c.query(
        "update attendance.businesses set name=$1,timezone=$2 where id=$3",
        [d.businessName, d.timezone, a.businessId],
      );
      for (const [key, value] of [
        ["branding", { accent: d.accent }],
        [
          "attendance_rules",
          {
            radiusM: d.radiusM,
            accuracyM: d.accuracyM,
            graceMinutes: d.graceMinutes,
            version: next.version,
          },
        ],
      ])
        await c.query(
          "insert into attendance.business_settings(business_id,key,value_json,updated_by) values($1,$2,$3,$4) on conflict(business_id,key) do update set value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=now()",
          [a.businessId, key, JSON.stringify(value), a.id],
        );
      await audit(c, a, "settings.update", "business", a.businessId, old, next);
      return next;
    });
  }
}
