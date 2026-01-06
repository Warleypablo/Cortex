/**
 * Maintenance Window Module
 * Blocks database operations during the daily sync window (13:00-14:30 BRT)
 */

const MAINTENANCE_START_HOUR = 13;
const MAINTENANCE_START_MINUTE = 0;
const MAINTENANCE_END_HOUR = 14;
const MAINTENANCE_END_MINUTE = 30;
const TIMEZONE = "America/Sao_Paulo";

export interface MaintenanceStatus {
  isInMaintenance: boolean;
  message: string;
  windowStart: string;
  windowEnd: string;
  resumesAt: string | null;
  remainingMinutes: number | null;
}

function getBrazilTime(): Date {
  const now = new Date();
  const brazilTime = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const parts: Record<string, string> = {};
  brazilTime.forEach(({ type, value }) => {
    parts[type] = value;
  });

  return new Date(
    parseInt(parts.year),
    parseInt(parts.month) - 1,
    parseInt(parts.day),
    parseInt(parts.hour),
    parseInt(parts.minute),
    parseInt(parts.second)
  );
}

export function isMaintenanceWindow(): boolean {
  if (process.env.SKIP_MAINTENANCE_WINDOW === "true") {
    return false;
  }

  const brazilNow = getBrazilTime();
  const currentHour = brazilNow.getHours();
  const currentMinute = brazilNow.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  const startTimeMinutes = MAINTENANCE_START_HOUR * 60 + MAINTENANCE_START_MINUTE;
  const endTimeMinutes = MAINTENANCE_END_HOUR * 60 + MAINTENANCE_END_MINUTE;

  return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
}

export function getMaintenanceStatus(): MaintenanceStatus {
  const isInMaintenance = isMaintenanceWindow();
  const brazilNow = getBrazilTime();
  
  const formatTime = (h: number, m: number) => 
    `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

  let remainingMinutes: number | null = null;
  let resumesAt: string | null = null;

  if (isInMaintenance) {
    const currentMinutes = brazilNow.getHours() * 60 + brazilNow.getMinutes();
    const endMinutes = MAINTENANCE_END_HOUR * 60 + MAINTENANCE_END_MINUTE;
    remainingMinutes = endMinutes - currentMinutes;
    
    const resumeDate = new Date(brazilNow);
    resumeDate.setHours(MAINTENANCE_END_HOUR, MAINTENANCE_END_MINUTE, 0, 0);
    resumesAt = resumeDate.toISOString();
  }

  return {
    isInMaintenance,
    message: isInMaintenance
      ? "O sistema está em atualização diária. Por favor, aguarde alguns minutos."
      : "Sistema operando normalmente.",
    windowStart: formatTime(MAINTENANCE_START_HOUR, MAINTENANCE_START_MINUTE),
    windowEnd: formatTime(MAINTENANCE_END_HOUR, MAINTENANCE_END_MINUTE),
    resumesAt,
    remainingMinutes,
  };
}

export function getMaintenanceResponse() {
  const status = getMaintenanceStatus();
  return {
    error: "maintenance",
    message: status.message,
    details: {
      windowStart: status.windowStart,
      windowEnd: status.windowEnd,
      resumesAt: status.resumesAt,
      remainingMinutes: status.remainingMinutes,
    },
  };
}
