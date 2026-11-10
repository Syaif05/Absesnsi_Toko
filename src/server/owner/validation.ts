import { z } from "zod";
import { loginCode } from "../auth/service";
const name = z.string().trim().min(1).max(120);
const radius = z.number().int().min(10).max(2000);
const storeFields = z
  .object({
    name,
    code: loginCode,
    address: z.string().trim().min(1).max(500),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    radiusM: radius,
    isActive: z.boolean(),
    operatingHours: z.string().trim().max(120),
  })
  .strict();
export const createStoreSchema = storeFields.extend({
  radiusM: radius.default(100),
  isActive: z.boolean().default(true),
  operatingHours: z.string().trim().max(120).default(""),
});
export const patchStoreSchema = storeFields
  .partial()
  .extend({ confirmSensitive: z.boolean().optional() })
  .strict();
const employeeFields = z
  .object({
    fullName: name,
    code: loginCode,
    storeId: z.uuid().nullable(),
    status: z.enum(["active", "inactive"]),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[+0-9 ()-]*$/)
      .nullable(),
    joinedAt: z.iso.date().nullable(),
  })
  .strict();
export const createEmployeeSchema = employeeFields.extend({
  code: loginCode.optional(),
  initialSchedule: z.object({startDate:z.iso.date(),days:z.array(z.number().int().min(0).max(6)).min(1).max(7)}).strict().optional(),
  storeId: z.uuid().nullable().default(null),
  status: z.enum(["active", "inactive"]).default("active"),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+0-9 ()-]*$/)
    .nullable()
    .default(null),
  joinedAt: z.iso.date().nullable().default(null),
});
export const patchEmployeeSchema = employeeFields
  .partial()
  .extend({ confirmSensitive: z.boolean().optional() })
  .strict();
export const settingsSchema = z
  .object({
    businessName: name,
    timezone: z.enum(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    radiusM: radius,
    accuracyM: z.number().int().min(10).max(1000),
    graceMinutes: z.number().int().min(0).max(120),
    version: z.number().int().min(0),
  })
  .strict();
export const listSchema = z.object({
  q: z.string().trim().max(120).default(""),
  storeId: z.uuid().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  offset: z.coerce.number().int().min(0).max(10000000).default(0),
});
