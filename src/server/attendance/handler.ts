import { authRuntime } from '../auth/runtime';
import { storageRuntime } from '../storage/runtime';
import { AttendanceService } from './service';
import { createAttendanceHandler } from './http';
export const handleAttendance=createAttendanceHandler(()=>{
  const {service,origin}=authRuntime();
  return {attendance:new AttendanceService(service,storageRuntime()),origin,authorize:(token:string)=>service.me(token)};
});
