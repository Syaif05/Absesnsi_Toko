import { z } from "zod";
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const templateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    startTime: time,
    endTime: time,
    crossesMidnight: z.boolean(),
    graceMinutes: z.number().int().min(0).max(120),
    isActive: z.boolean().default(true),
  })
  .strict();
export const editTemplateSchema = templateSchema.extend({
  isActive: z.boolean(),
  version: z.number().int().positive(),
});
export const scheduleSchema = z
  .object({
    employeeId: z.uuid(),
    storeId: z.uuid(),
    templateId: z.uuid().nullable().default(null),
    date: z.iso.date(),
    startTime: time,
    endTime: time,
    crossesMidnight: z.boolean(),
  })
  .strict();
export const editScheduleSchema = scheduleSchema.extend({
  version: z.number().int().positive(),
  confirmWithAttendance: z.boolean().default(false),
});
export const decisionSchema = z
  .object({
    status: z.enum(["published", "cancelled"]),
    version: z.number().int().positive(),
    confirmed: z.literal(true),
    confirmWithAttendance: z.boolean().default(false),
  })
  .strict();
export const rangeSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    employeeId: z.uuid().optional(),
    storeId: z.uuid().optional(),
    status: z.enum(["draft", "published", "cancelled"]).optional(),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const batchScheduleSchema = z.object({
  items: z.array(scheduleSchema).min(1).max(100),
  publish: z.boolean().default(false),
  confirmed: z.boolean().default(false),
}).strict().refine(value => !value.publish || value.confirmed, {message:"Konfirmasi diperlukan untuk menerbitkan jadwal."});
