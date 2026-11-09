export type Store = {
  id: string;
  code: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
  operating_hours: string;
};
export type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  primary_store_id: string | null;
  status: "active" | "inactive";
  phone: string | null;
  joined_at: string | null;
  role: "employee";
};
export type BusinessSettings = {
  businessName: string;
  timezone: string;
  accent: string;
  radiusM: number;
  accuracyM: number;
  graceMinutes: number;
  version: number;
};
export type Page<T> = { items: T[]; hasMore: boolean; nextOffset: number };
