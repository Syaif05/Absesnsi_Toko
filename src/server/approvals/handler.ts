import { authRuntime } from '../auth/runtime';
import { ApprovalService } from './service';
import { createApprovalHandler } from './http';
export const handleApprovals=createApprovalHandler(()=>{
 const {service,origin}=authRuntime();return {approvals:new ApprovalService(service),origin};
});
