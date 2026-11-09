import { authRuntime } from "../auth/runtime";
import { ScheduleService } from "./service";
import { createScheduleHandler } from "./http";
export const handleSchedules = createScheduleHandler(() => {
  const { service, origin } = authRuntime();
  return { schedules: new ScheduleService(service), origin };
});
