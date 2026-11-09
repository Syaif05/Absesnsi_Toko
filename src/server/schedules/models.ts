export type ShiftTemplate = {
  id: string;
  name: string;
  start_local_time: string;
  end_local_time: string;
  crosses_midnight: boolean;
  grace_minutes: number;
  is_active: boolean;
  version: number;
};
export type ScheduledShift = {
  id: string;
  employee_id: string;
  employee_name: string;
  store_id: string;
  store_name: string;
  template_id: string | null;
  starts_at: string;
  ends_at: string;
  status: "draft" | "published" | "cancelled";
  version: number;
  rule_snapshot: Record<string, unknown>;
  has_attendance: boolean;
};
export type SchedulePerson = { id: string; full_name: string; role: string };
export type ScheduleInput = {
  employeeId: string;
  storeId: string;
  templateId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
};
