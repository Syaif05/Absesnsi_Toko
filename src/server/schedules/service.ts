import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AuthService } from "../auth/service";
import { AuthError, type Identity, type SqlConnection } from "../auth/types";
import {
  batchScheduleSchema,
  templateSchema,
  editTemplateSchema,
  scheduleSchema,
  editScheduleSchema,
  decisionSchema,
  rangeSchema,
} from "./validation";
import { shiftInstants, rangeInstants } from "./time";
import type { ShiftTemplate, ScheduledShift, SchedulePerson } from "./models";
const columns =
  "s.id,s.employee_id,e.full_name as employee_name,s.store_id,t.name as store_name,s.template_id,s.starts_at,s.ends_at,s.status,s.version,s.rule_snapshot,exists(select 1 from attendance.attendance_sessions a where a.schedule_id=s.id) as has_attendance";
const joined =
  "attendance.schedules s join attendance.employees e on e.id=s.employee_id join attendance.stores t on t.id=s.store_id";
const normalize = (row: ScheduledShift): ScheduledShift => ({
  ...row,
  starts_at: new Date(row.starts_at).toISOString(),
  ends_at: new Date(row.ends_at).toISOString(),
});
const missing = () =>
  new AuthError("NOT_FOUND", 404, "Data jadwal atau template tidak ditemukan.");
const conflict = () =>
  new AuthError(
    "CONFLICT",
    409,
    "Data telah berubah. Muat ulang sebelum menyimpan.",
  );
async function audit(
  c: SqlConnection,
  a: Identity,
  action: string,
  kind: string,
  id: string,
  before: unknown,
  after: unknown,
) {
  await c.query(
    "insert into attendance.audit_logs(actor_id,action,entity_type,entity_id,metadata_redacted) values($1,$2,$3,$4,$5)",
    [a.id, action, kind, id, JSON.stringify({ before, after })],
  );
}
async function business(c: SqlConnection, id: string) {
  return (
    await c.query<{ timezone: string }>(
      "select timezone from attendance.businesses where id=$1",
      [id],
    )
  ).rows[0];
}
async function read(c: SqlConnection, a: Identity, id: string, lock = false) {
  const row = (
    await c.query<ScheduledShift>(
      `select ${columns} from ${joined} where s.id=$1 and e.business_id=$2 and t.business_id=$2 ${lock ? "for update of s" : ""}`,
      [id, a.businessId],
    )
  ).rows[0];
  if (!row) throw missing();
  return normalize(row);
}
async function activeTargets(
  c: SqlConnection,
  a: Identity,
  employeeId: string,
  storeId: string,
) {
  const employee = (
    await c.query(
      "select id from attendance.employees where id=$1 and business_id=$2 and status='active' and role in ('employee','owner') for update",
      [employeeId, a.businessId],
    )
  ).rows[0];
  const store = (
    await c.query(
      "select id from attendance.stores where id=$1 and business_id=$2 and is_active=true for update",
      [storeId, a.businessId],
    )
  ).rows[0];
  if (!employee || !store)
    throw new AuthError(
      "INVALID_ASSIGNMENT",
      400,
      "Pilih karyawan dan toko aktif dari usaha yang sama.",
    );
}
export class ScheduleService {
  constructor(private auth: AuthService) {}
  get(token: string, id: string) {
    z.uuid().parse(id);
    return this.auth.withOwner(token, (c, a) => read(c, a, id));
  }
  getTemplate(token: string, id: string) {
    z.uuid().parse(id);
    return this.auth.withOwner(token, async (c, a) => {
      const row = (
        await c.query<ShiftTemplate>(
          "select * from attendance.shift_templates where id=$1 and business_id=$2",
          [id, a.businessId],
        )
      ).rows[0];
      if (!row) throw missing();
      return row;
    });
  }
  people(token: string, offsetValue: unknown = 0) {
    return this.auth.withOwner(token, async (c, a) => {
      const offset = z.coerce.number().int().nonnegative().parse(offsetValue);
      const rows = (
        await c.query<SchedulePerson>(
          "select id,full_name,role from attendance.employees where business_id=$1 and status='active' and role in ('employee','owner') order by full_name,id limit 51 offset $2",
          [a.businessId, offset],
        )
      ).rows;
      return {
        items: rows.slice(0, 50),
        hasMore: rows.length > 50,
        nextOffset: offset + 50,
      };
    });
  }
  templates(token: string, offsetValue: unknown = 0) {
    return this.auth.withOwner(token, async (c, a) => {
      const offset = z.coerce.number().int().nonnegative().parse(offsetValue);
      const rows = (
        await c.query<ShiftTemplate>(
          "select * from attendance.shift_templates where business_id=$1 order by name,id limit 51 offset $2",
          [a.businessId, offset],
        )
      ).rows;
      return {
        items: rows.slice(0, 50),
        hasMore: rows.length > 50,
        nextOffset: offset + 50,
      };
    });
  }
  saveTemplate(token: string, input: unknown, id?: string) {
    if (id) z.uuid().parse(id);
    return this.auth.withOwner(token, async (c, a) => {
      const d = id
        ? editTemplateSchema.parse(input)
        : templateSchema.parse(input);
      shiftInstants(
        "2026-01-01",
        d.startTime,
        d.endTime,
        d.crossesMidnight,
        "Asia/Jakarta",
      );
      const old = id
        ? (
            await c.query<ShiftTemplate>(
              "select * from attendance.shift_templates where id=$1 and business_id=$2 for update",
              [id, a.businessId],
            )
          ).rows[0]
        : null;
      if (id && !old) throw missing();
      if (old && (!("version" in d) || d.version !== old.version))
        throw conflict();
      const target = id ?? randomUUID();
      const next = (
        await c.query<ShiftTemplate>(
          old
            ? "update attendance.shift_templates set name=$1,start_local_time=$2,end_local_time=$3,crosses_midnight=$4,grace_minutes=$5,is_active=$6,version=version+1,updated_at=now() where id=$7 and business_id=$8 returning *"
            : "insert into attendance.shift_templates(name,start_local_time,end_local_time,crosses_midnight,grace_minutes,is_active,id,business_id) values($1,$2,$3,$4,$5,$6,$7,$8) returning *",
          [
            d.name,
            d.startTime,
            d.endTime,
            d.crossesMidnight,
            d.graceMinutes,
            d.isActive,
            target,
            a.businessId,
          ],
        )
      ).rows[0];
      await audit(
        c,
        a,
        old ? "template.update" : "template.create",
        "shift_template",
        target,
        old,
        next,
      );
      return next;
    });
  }
  private async snapshot(
    c: SqlConnection,
    a: Identity,
    storeId: string,
    templateId: string | null,
  ) {
    const store = (
      await c.query<{ lat: number; lng: number; radius_m: number }>(
        "select lat,lng,radius_m from attendance.stores where id=$1 and business_id=$2",
        [storeId, a.businessId],
      )
    ).rows[0];
    const rules =
      (
        await c.query<{ value_json: Record<string, unknown> }>(
          "select value_json from attendance.business_settings where business_id=$1 and key='attendance_rules'",
          [a.businessId],
        )
      ).rows[0]?.value_json ?? {};
    const template = templateId
      ? (
          await c.query<ShiftTemplate>(
            "select * from attendance.shift_templates where id=$1 and business_id=$2 and is_active=true",
            [templateId, a.businessId],
          )
        ).rows[0]
      : null;
    if (templateId && !template)
      throw new AuthError(
        "INVALID_TEMPLATE",
        400,
        "Template tidak tersedia atau sudah nonaktif.",
      );
    return {
      timezone: (await business(c, a.businessId)).timezone,
      grace_minutes: template?.grace_minutes ?? Number(rules.graceMinutes ?? 5),
      accuracy_m: Number(rules.accuracyM ?? 100),
      radius_m: store.radius_m,
      store_lat: store.lat,
      store_lng: store.lng,
      rules_version: Number(rules.version ?? 0),
      template: template
        ? {
            id: template.id,
            name: template.name,
            version: template.version,
            start: template.start_local_time,
            end: template.end_local_time,
          }
        : null,
    };
  }
  private async insert(c: SqlConnection, a: Identity, d: z.infer<typeof scheduleSchema>) {
    await activeTargets(c, a, d.employeeId, d.storeId);
    const snapshot = await this.snapshot(c, a, d.storeId, d.templateId);
    const times = shiftInstants(
      d.date,
      d.startTime,
      d.endTime,
      d.crossesMidnight,
      snapshot.timezone,
    );
    const id = randomUUID();
    await c.query(
      "insert into attendance.schedules(id,employee_id,store_id,template_id,starts_at,ends_at,created_by,rule_snapshot) values($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        d.employeeId,
        d.storeId,
        d.templateId,
        times.startsAt,
        times.endsAt,
        a.id,
        JSON.stringify(snapshot),
      ],
    );
    const next = await read(c, a, id);
    await audit(c, a, "schedule.create", "schedule", id, null, next);
    return next;
  }
  create(token: string, input: unknown) {
    return this.auth.withOwner(token, (c, a) => this.insert(c, a, scheduleSchema.parse(input)));
  }
  createBatch(token: string, input: unknown) {
    return this.auth.withOwner(token, async (c, a) => {
      const { items, publish } = batchScheduleSchema.parse(input);
      // Lock targets in a stable order before checking conflicts, including concurrent batches.
      for (const employeeId of [...new Set(items.map(item => item.employeeId))].sort()) {
        const found = await c.query("select id from attendance.employees where id=$1 and business_id=$2 and status='active' and role in ('employee','owner') for update", [employeeId, a.businessId]);
        if (!found.rows.length) throw new AuthError('INVALID_ASSIGNMENT',400,'Pilih karyawan aktif dari usaha ini.');
      }
      const timezone = (await business(c, a.businessId)).timezone;
      const created: ScheduledShift[] = [];
      for (const item of items) {
        const times = shiftInstants(item.date,item.startTime,item.endTime,item.crossesMidnight,timezone);
        const overlap = await c.query("select id from attendance.schedules where employee_id=$1 and status in ('draft','published') and starts_at<$3 and ends_at>$2 limit 1", [item.employeeId,times.startsAt,times.endsAt]);
        if (overlap.rows.length) throw new AuthError('SCHEDULE_OVERLAP',409,`Ada jadwal yang bertabrakan pada ${item.date}. Tidak ada jadwal baru disimpan. Ubah pilihan atau periksa jadwal yang sudah ada.`);
        let next = await this.insert(c,a,item);
        if (publish) {
          await c.query("update attendance.schedules set status='published',published_at=now(),version=version+1 where id=$1",[next.id]);
          const published = await read(c,a,next.id);
          await audit(c,a,'schedule.published','schedule',next.id,next,published);
          next = published;
        }
        created.push(next);
      }
      return { count: created.length, items: created };
    });
  }
  update(token: string, id: string, input: unknown) {
    z.uuid().parse(id);
    return this.auth.withOwner(token, async (c, a) => {
      const d = editScheduleSchema.parse(input);
      const old = await read(c, a, id, true);
      if (d.version !== old.version) throw conflict();
      if (old.status === "cancelled")
        throw new AuthError(
          "INVALID_TRANSITION",
          409,
          "Jadwal dibatalkan tidak dapat diedit. Buat jadwal baru.",
        );
      if (old.has_attendance && !d.confirmWithAttendance)
        throw new AuthError(
          "ATTENDANCE_CONFIRMATION_REQUIRED",
          409,
          "Sudah ada absensi. Konfirmasi perubahan waktu untuk mempertahankan histori.",
        );
      if (
        old.has_attendance &&
        (d.employeeId !== old.employee_id ||
          d.storeId !== old.store_id ||
          d.templateId !== old.template_id)
      )
        throw new AuthError(
          "ATTENDANCE_IDENTITY_LOCKED",
          409,
          "Karyawan, toko dan template tidak boleh diganti setelah ada absensi.",
        );
      if (
        old.status === "draft" ||
        d.employeeId !== old.employee_id ||
        d.storeId !== old.store_id
      )
        await activeTargets(c, a, d.employeeId, d.storeId);
      const preserve =
        old.has_attendance ||
        (old.status === "published" &&
          d.storeId === old.store_id &&
          d.templateId === old.template_id);
      const nextSnapshot = preserve
        ? old.rule_snapshot
        : {
            ...(await this.snapshot(c, a, d.storeId, d.templateId)),
            timezone: String(
              old.rule_snapshot.timezone ??
                (await business(c, a.businessId)).timezone,
            ),
          };
      const times = shiftInstants(
        d.date,
        d.startTime,
        d.endTime,
        d.crossesMidnight,
        String(
          nextSnapshot.timezone ?? (await business(c, a.businessId)).timezone,
        ),
      );
      await c.query(
        "update attendance.schedules set employee_id=$1,store_id=$2,template_id=$3,starts_at=$4,ends_at=$5,rule_snapshot=$6,version=version+1,updated_at=now() where id=$7",
        [
          d.employeeId,
          d.storeId,
          d.templateId,
          times.startsAt,
          times.endsAt,
          JSON.stringify(nextSnapshot),
          id,
        ],
      );
      const next = await read(c, a, id);
      await audit(c, a, "schedule.update", "schedule", id, old, next);
      return next;
    });
  }
  decide(token: string, id: string, input: unknown) {
    z.uuid().parse(id);
    return this.auth.withOwner(token, async (c, a) => {
      const d = decisionSchema.parse(input),
        old = await read(c, a, id, true);
      if (d.version !== old.version) throw conflict();
      if (
        old.status === "cancelled" ||
        (d.status === "published" && old.status !== "draft")
      )
        throw new AuthError(
          "INVALID_TRANSITION",
          409,
          "Status jadwal tidak dapat diubah seperti itu.",
        );
      if (old.has_attendance && !d.confirmWithAttendance)
        throw new AuthError(
          "ATTENDANCE_CONFIRMATION_REQUIRED",
          409,
          "Sudah ada absensi; konfirmasi pembatalan diperlukan.",
        );
      let snapshot = old.rule_snapshot;
      if (d.status === "published") {
        await activeTargets(c, a, old.employee_id, old.store_id);
        snapshot = await this.snapshot(c, a, old.store_id, old.template_id);
        snapshot = {
          ...snapshot,
          timezone: old.rule_snapshot.timezone ?? snapshot.timezone,
        };
      }
      await c.query(
        "update attendance.schedules set status=$1,published_at=case when $1='published' then now() else published_at end,rule_snapshot=$2,version=version+1,updated_at=now() where id=$3",
        [d.status, JSON.stringify(snapshot), id],
      );
      const next = await read(c, a, id);
      await audit(c, a, "schedule." + d.status, "schedule", id, old, next);
      return next;
    });
  }
  private async range(
    c: SqlConnection,
    a: Identity,
    input: unknown,
    own: boolean,
  ) {
    const p = rangeSchema.parse(input),
      timezone = (await business(c, a.businessId)).timezone;
    const { start, end } = rangeInstants(p.from, p.to, timezone);
    const rows = (
      await c.query<ScheduledShift>(
        `select ${columns} from ${joined} where e.business_id=$1 and t.business_id=$1 and s.starts_at<$3 and s.ends_at>$2 and ($4::uuid is null or s.employee_id=$4) and ($5::uuid is null or s.store_id=$5) and ($6::text is null or s.status=$6) order by s.starts_at,s.id limit 51 offset $7`,
        [
          a.businessId,
          start,
          end,
          own ? a.id : (p.employeeId ?? null),
          p.storeId ?? null,
          own ? "published" : (p.status ?? null),
          p.offset,
        ],
      )
    ).rows;
    return {
      items: rows.slice(0, 50).map(normalize),
      hasMore: rows.length > 50,
      nextOffset: p.offset + 50,
      timezone,
    };
  }
  list(token: string, input: unknown) {
    return this.auth.withOwner(token, (c, a) => this.range(c, a, input, false));
  }
  timezone(token: string) {
    return this.auth.withIdentity(
      token,
      async (c, a) => (await business(c, a.businessId)).timezone,
    );
  }
  async own(token: string, input: unknown) {
    const d = z
      .object({
        from: z.iso.date(),
        to: z.iso.date(),
        offset: z.coerce.number().int().nonnegative().default(0),
      })
      .strict()
      .parse(input);
    return this.auth.withIdentity(token, (c, a) => this.range(c, a, d, true));
  }
}
