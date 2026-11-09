import { AuthError } from "../auth/types";
const offsets: Record<string, number> = {
  "Asia/Jakarta": 7,
  "Asia/Makassar": 8,
  "Asia/Jayapura": 9,
};
export function shiftInstants(
  date: string,
  start: string,
  end: string,
  crossesMidnight: boolean,
  timezone: string,
) {
  const offset = offsets[timezone];
  if (offset === undefined)
    throw new AuthError(
      "INVALID_TIMEZONE",
      400,
      "Zona waktu usaha belum didukung.",
    );
  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3)),
    endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));
  const duration = endMinutes - startMinutes + (crossesMidnight ? 1440 : 0);
  if (duration <= 0 || duration > 1440)
    throw new AuthError(
      "INVALID_SHIFT",
      400,
      "Periksa jam shift dan pilihan melewati tengah malam (maksimal 24 jam).",
    );
  const starts = new Date(date + "T" + start + ":00+0" + offset + ":00");
  const ends = new Date(starts.getTime() + duration * 60000);
  return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
}
export function rangeInstants(from: string, to: string, timezone: string) {
  const start = shiftInstants(from, "00:00", "00:00", true, timezone).startsAt;
  const end = shiftInstants(to, "00:00", "00:00", true, timezone).startsAt;
  const days = (Date.parse(end) - Date.parse(start)) / 86400000;
  if (days <= 0 || days > 31)
    throw new AuthError(
      "INVALID_RANGE",
      400,
      "Rentang tanggal harus 1–31 hari; tanggal akhir tidak termasuk.",
    );
  return { start, end };
}
