import { authRuntime } from '../auth/runtime';
import { ReportingService } from './service';
import { createReportingHandler } from './http';
export const handleReporting=createReportingHandler(()=>({reporting:new ReportingService(authRuntime().service)}));
