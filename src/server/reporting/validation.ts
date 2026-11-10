import { z } from 'zod';
export const filtersSchema=z.object({from:z.iso.date(),to:z.iso.date(),storeId:z.uuid().optional(),employeeId:z.uuid().optional()}).strict();
export const pageSchema=filtersSchema.extend({offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict();
export const historySchema=pageSchema.extend({category:z.enum(['all','valid','pending','rejected','not_recorded','upcoming']).default('all')}).strict();
export type ReportFilters=z.infer<typeof filtersSchema>;
