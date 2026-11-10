import type { Page } from '../owner/models';
export type AttendanceCategory='valid'|'pending'|'rejected'|'not_recorded'|'upcoming';
export interface Metrics {
 total:number;recorded:number;valid:number;pending:number;rejected:number;notRecorded:number;upcoming:number;
 employees:number;late:number;missingCheckout:number;
}
export interface ReportSummary {
 businessName:string;timezone:string;from:string;to:string;generatedAt:string;
 scope:{storeId:string|null;storeName:string|null;employeeId:string|null;employeeName:string|null};metrics:Metrics;pendingRequests:number;daily:({date:string}&Metrics)[];
}
export interface AttendanceRow {
 scheduleId:string;sessionId:string|null;employeeId:string;employeeCode:string;employeeName:string;employeeActive:boolean;
 storeId:string;storeName:string;storeActive:boolean;scheduleStatus:string;startsAt:string;endsAt:string;
 checkInAt:string|null;checkOutAt:string|null;category:AttendanceCategory;sessionStatus:string|null;
 isCorrected:boolean;late:boolean;missingCheckout:boolean;
}
export interface StoreReport {id:string;name:string;isActive:boolean;metrics:Metrics}
export interface Activity {
 id:string;kind:'check_in'|'check_out'|'approval_submitted'|'approved'|'rejected';at:string;
 employeeId:string;employeeName:string;storeName:string;scheduleId:string;sessionId:string|null;
 approvalId:string|null;reviewStatus:string|null;requestType:string|null;
}
export interface SessionDetail {
 attendance:AttendanceRow;timezone:string;locationRule:{storeName:string;lat:number|null;lng:number|null;radiusM:number|null;accuracyM:number|null;graceMinutes:number|null};
 events:{id:string;eventType:string;recordedAt:string;locationStatus:string;reviewStatus:string;lat:number|null;lng:number|null;accuracyM:number|null;distanceM:number|null;reason:string|null;photoAvailable:boolean}[];
 requests:Page<{requestId:string;type:string;status:string;reason:string;createdAt:string;decidedAt:string|null;reviewerName:string|null;decisionNote:string|null;changes:{field:string;before:string|null;requested:string;applied:string|null}[]}>;
}
export interface EmployeeReport {employee:{id:string;code:string;name:string;active:boolean};summary:ReportSummary;history:Page<AttendanceRow>}
