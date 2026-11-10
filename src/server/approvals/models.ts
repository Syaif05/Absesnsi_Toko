export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type CorrectionField = 'check_in_at' | 'check_out_at';
export interface ApprovalSummary {
 id:string; type:'attendance_correction'|'location_exception'; requesterId:string; requesterName:string;
 storeName:string; scheduleId:string; status:ApprovalStatus; reason:string; createdAt:string;
 decidedAt:string|null; reviewerName:string|null; decisionNote:string|null;
}
export interface ApprovalDetail extends ApprovalSummary {
 timezone:string;
 schedule:{startsAt:string;endsAt:string;status:string};
 session:{id:string;checkInAt:string|null;checkOutAt:string|null;status:string;isCorrected:boolean;late:boolean;missingCheckout:boolean}|null;
 corrections:{field:CorrectionField;oldValue:string|null;requestedValue:string;appliedValue:string|null}[];
 evidence:{id:string;eventType:string;recordedAt:string;lat:number|null;lng:number|null;accuracyM:number|null;distanceM:number|null;locationStatus:string;reviewStatus:string;reason:string|null;photoAvailable:boolean}[];
 storeLocation:{lat:number|null;lng:number|null;radiusM:number|null};
}
export interface CorrectionTarget {
 scheduleId:string;storeName:string;startsAt:string;endsAt:string;timezone:string;
 checkInAt:string|null;checkOutAt:string|null;sessionId:string|null;isCorrected:boolean;
}
