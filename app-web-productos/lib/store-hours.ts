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

export type StoreOpenStatus = {
  isOpen: boolean;
  dayKey: string;
  label: string;
  detail: string;
};

const LIMA_TIME_ZONE = "America/Lima";

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
  const { year, month, day } = getLimaDateParts(now);
  return `${year}-${month}-${day}`;
}

function getLimaDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
  };
}

function getDayKeyForDate(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return null;

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );

  if (Number.isNaN(date.getTime())) return null;
  return String(date.getUTCDay());
}

function addDays(dateValue: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return "";

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days)
  );

  return date.toISOString().slice(0, 10);
}

export function getCurrentLimaDayKey(now = new Date()) {
  const parts = getLimaDateParts(now);
  return getDayKeyForDate(`${parts.year}-${parts.month}-${parts.day}`) ?? "0";
}

export function getOpeningDayForDate(
  dateValue: string,
  hours: StoreOpeningHours
) {
  const dayKey = getDayKeyForDate(dateValue);
  return dayKey ? hours[dayKey] ?? null : null;
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
    const today = getTodayDateInput(now);

    if (dateValue < today) continue;

    if (dateValue === today) {
      const limaParts = getLimaDateParts(now);
      const currentMinutes =
        Number(limaParts.hour) * 60 + Number(limaParts.minute);

      if (minutes <= currentMinutes) continue;
    }

    slots.push({
      value: time,
      label: time,
    });
  }

  return slots;
}

export function getStoreOpenStatus(
  hours: StoreOpeningHours,
  now = new Date()
): StoreOpenStatus {
  const limaParts = getLimaDateParts(now);
  const today = `${limaParts.year}-${limaParts.month}-${limaParts.day}`;
  const dayKey = getDayKeyForDate(today) ?? "0";
  const dayHours = hours[dayKey];
  const currentMinutes =
    Number(limaParts.hour) * 60 + Number(limaParts.minute);

  if (
    dayHours &&
    !dayHours.closed &&
    currentMinutes >= timeToMinutes(dayHours.open) &&
    currentMinutes < timeToMinutes(dayHours.close)
  ) {
    return {
      isOpen: true,
      dayKey,
      label: "Abierto ahora",
      detail: `Hasta las ${dayHours.close}`,
    };
  }

  if (
    dayHours &&
    !dayHours.closed &&
    currentMinutes < timeToMinutes(dayHours.open)
  ) {
    return {
      isOpen: false,
      dayKey,
      label: "Cerrado ahora",
      detail: `Abre hoy a las ${dayHours.open}`,
    };
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const nextDate = addDays(today, offset);
    const nextDayKey = getDayKeyForDate(nextDate);
    if (!nextDayKey) continue;

    const nextHours = hours[nextDayKey];
    if (!nextHours || nextHours.closed) continue;

    const day = STORE_DAYS.find((item) => item.key === nextDayKey);
    const when = offset === 1 ? "mañana" : `el ${day?.label.toLowerCase()}`;

    return {
      isOpen: false,
      dayKey,
      label: "Cerrado ahora",
      detail: `Abre ${when} a las ${nextHours.open}`,
    };
  }

  return {
    isOpen: false,
    dayKey,
    label: "Cerrado",
    detail: "Sin próxima apertura registrada",
  };
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
