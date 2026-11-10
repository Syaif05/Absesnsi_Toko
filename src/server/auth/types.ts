export interface SqlConnection {
 query<T extends Record<string, unknown> = Record<string, unknown>>(text:string,values?:unknown[]):Promise<{rows:T[]}>;
}
export interface AuthDatabase { transaction<T>(work:(connection:SqlConnection)=>Promise<T>):Promise<T> }
export type Identity = {id:string;businessId:string;fullName:string;role:'owner'|'employee'|'manager';pinChangeSuggested:boolean};
export class AuthError extends Error {
 constructor(public code:string,public status:number, message:string){super(message)}
}
export const invalidLogin=()=>new AuthError('INVALID_LOGIN',401,'ID atau kredensial tidak valid.');
export function requireOwner(actor:Identity){
 if(actor.role!=='owner')throw new AuthError('FORBIDDEN',403,'Akses tidak diizinkan.');
}
export function requireOwnResource(actor:Identity,employeeId:string,businessId:string){
 if(actor.businessId!==businessId||(actor.role!=='owner'&&actor.id!==employeeId))throw new AuthError('FORBIDDEN',403,'Akses tidak diizinkan.');
}
