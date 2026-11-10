import { z } from 'zod';
const reason=z.string().trim().min(5).max(1000);
const change=z.object({field:z.enum(['check_in_at','check_out_at']),value:z.iso.datetime({offset:true}).transform(v=>new Date(v).toISOString())}).strict();
export const submissionSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('attendance_correction'),requestKey:z.uuid(),scheduleId:z.uuid(),reason,changes:z.array(change).min(1).max(2).refine(v=>new Set(v.map(i=>i.field)).size===v.length,'Kolom tidak boleh berulang.')}).strict(),
 z.object({type:z.literal('location_exception'),requestKey:z.uuid(),eventId:z.uuid(),reason}).strict(),
]);
export const decisionSchema=z.object({status:z.enum(['approved','rejected']),note:z.string().trim().min(3).max(1000),confirmed:z.literal(true)}).strict();
export const listSchema=z.object({view:z.enum(['mine','inbox']).optional(),status:z.enum(['pending','approved','rejected','all']).default('all'),type:z.enum(['attendance_correction','location_exception']).optional(),storeId:z.uuid().optional(),offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict();
