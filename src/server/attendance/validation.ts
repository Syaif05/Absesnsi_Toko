import { z } from 'zod';
export const locationSchema = z.discriminatedUnion('status',[
  z.object({status:z.literal('available'),lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180),accuracyM:z.number().min(0).max(100000)}).strict(),
  z.object({status:z.enum(['denied','unavailable'])}).strict(),
]);
export const submissionSchema = z.object({idempotencyKey:z.uuid(),scheduleId:z.uuid(),location:locationSchema,reason:z.string().trim().max(1000).default('')}).strict();
export type Submission = z.infer<typeof submissionSchema>;
export const ruleSchema = z.object({radius_m:z.number().positive(),accuracy_m:z.number().positive(),store_lat:z.number().min(-90).max(90),store_lng:z.number().min(-180).max(180),grace_minutes:z.number().min(0)}).passthrough();
export function haversine(lat:number,lng:number,toLat:number,toLng:number) {
  const rad = Math.PI/180, a = Math.sin((toLat-lat)*rad/2)**2 + Math.cos(lat*rad)*Math.cos(toLat*rad)*Math.sin((toLng-lng)*rad/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));
}
export function classifyLocation(location:Submission['location'], rules:z.infer<typeof ruleSchema>) {
  if(location.status!=='available') return {status:location.status,distance:null};
  const distance=haversine(location.lat,location.lng,rules.store_lat,rules.store_lng);
  return {status:location.accuracyM>rules.accuracy_m?'inaccurate':distance>rules.radius_m?'outside':'inside',distance};
}
