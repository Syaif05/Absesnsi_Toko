import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from '../db/schema';
export interface WorkforceRepository {
 listEmployees(businessId:string):Promise<(typeof schema.employees.$inferSelect)[]>;
 listStores(businessId:string):Promise<(typeof schema.stores.$inferSelect)[]>;
 updateEmployeeCode(businessId:string,id:string,code:string):Promise<(typeof schema.employees.$inferSelect)[]>;
}
// Authorization belongs to the future application service; never call from client components.
export function workforceRepository(db:Pick<PgDatabase<PgQueryResultHKT, typeof schema>,'select'|'update'>):WorkforceRepository{
 return {
 listEmployees:businessId=>db.select().from(schema.employees).where(eq(schema.employees.businessId,businessId)),
 listStores:businessId=>db.select().from(schema.stores).where(eq(schema.stores.businessId,businessId)),
 updateEmployeeCode:(businessId,id,code)=>db.update(schema.employees).set({employeeCode:code}).where(and(eq(schema.employees.businessId,businessId),eq(schema.employees.id,id))).returning(),
 };
}
