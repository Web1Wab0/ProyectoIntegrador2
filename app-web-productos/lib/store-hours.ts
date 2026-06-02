export type StoreDayHours = {
  closed: boolean;
  open: string;
  close: string;
};

export type StoreOpeningHours = Record<string, StoreDayHours>;

export const STORE_DAYS = [
  { key: "1", label: "Lunes", shortLabel: "Lun" },
  { key: "2", label: "Martes", shortLabel: "Mar" },
  { key: "3", label: "Miercoles", shortLabel: "Mie" },
  { key: "4", label: "Jueves", shortLabel: "Jue" },
  { key: "5", label: "Viernes", shortLabel: "Vie" },
  { key: "6", label: "Sabado", shortLabel: "Sab" },
  { key: "0", label: "Domingo", shortLabel: "Dom" },
] as const;

export const DEFAULT_OPENING_HOURS: StoreOpeningHours = {
  "0": { closed: false, open: "08:00", close: "20:00" },
  "1": { closed: false, open: "08:00", close: "20:00" },
  "2": { closed: false, open: "08:00", close: "20:00" },
  "3": { closed: false, open: "08:00", close: "20:00" },
  "4": { closed: false, open: "08:00", close: "20:00" },
  "5": { closed: false, open: "08:00", close: "20:00" },
  "6": { closed: false, open: "08:00", close: "20:00" },
};

export type PickupSlot = {
  value: string;
  label: string;
};

function cloneDefaultOpeningHours() {
  return Object.fromEntries(
    Object.entries(DEFAULT_OPENING_HOURS).map(([key, value]) => [
      key,
      { ...value },
    ])
  ) as StoreOpeningHours;
}

function isTimeValue(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function normalizeOpeningHours(value: unknown): StoreOpeningHours {
  const normalized = cloneDefaultOpeningHours();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return normalized;
  }

  Object.keys(DEFAULT_OPENING_HOURS).forEach((dayKey) => {
    const dayValue = (value as Record<string, unknown>)[dayKey];

    if (!dayValue || typeof dayValue !== "object" || Array.isArray(dayValue)) {
      return;
    }

    const row = dayValue as Record<string, unknown>;
    normalized[dayKey] = {
      closed: row.closed === true,
      open: isTimeValue(row.open) ? row.open : DEFAULT_OPENING_HOURS[dayKey].open,
      close: isTimeValue(row.close)
        ? row.close
        : DEFAULT_OPENING_HOURS[dayKey].close,
    };
  });

  return normalized;
}

export function validateOpeningHours(hours: StoreOpeningHours) {
  for (const day of STORE_DAYS) {
    const value = hours[day.key];

    if (value.closed) continue;

    if (!isTimeValue(value.open) || !isTimeValue(value.close)) {
      return `${day.label}: usa horas validas.`;
    }

    if (timeToMinutes(value.open) >= timeToMinutes(value.close)) {
      return `${day.label}: la apertura debe ser menor que el cierre.`;
    }
  }

  return null;
}

export function getTodayDateInput(now = new Date()) {
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getOpeningDayForDate(
  dateValue: string,
  hours: StoreOpeningHours
) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return hours[String(date.getDay())] ?? null;
}

export function getAvailablePickupSlots(
  dateValue: string,
  hours: StoreOpeningHours,
  intervalMinutes = 30,
  now = new Date()
): PickupSlot[] {
  const dayHours = getOpeningDayForDate(dateValue, hours);

  if (!dayHours || dayHours.closed) return [];

  const openMinutes = timeToMinutes(dayHours.open);
  const closeMinutes = timeToMinutes(dayHours.close);

  if (openMinutes >= closeMinutes) return [];

  const slots: PickupSlot[] = [];

  for (
    let minutes = openMinutes;
    minutes < closeMinutes;
    minutes += intervalMinutes
  ) {
    const time = minutesToTime(minutes);
    const slotDate = new Date(`${dateValue}T${time}:00`);

    if (Number.isNaN(slotDate.getTime()) || slotDate <= now) {
      continue;
    }

    slots.push({
      value: time,
      label: time,
    });
  }

  return slots;
}

export function formatOpeningHours(hours: StoreOpeningHours) {
  const parts = STORE_DAYS.map((day) => {
    const value = hours[day.key];

    if (!value || value.closed) {
      return `${day.shortLabel}: Cerrado`;
    }

    return `${day.shortLabel}: ${value.open}-${value.close}`;
  });

  return parts.join(" | ");
}
