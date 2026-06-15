// Shared isomorphic date/time helpers (safe on both server and client)

export const WD_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;
export const MO_SHORT = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
] as const;

/**
 * Форматирует строку времени доставки вида "YYYY-MM-DD HH:MM"
 * в человекочитаемый формат на русском.
 */
export function formatDeliveryTime(v: string | null | undefined): string {
  if (!v) return "Как можно скорее";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{1,2}):(\d{2})$/);
  if (!m) return String(v);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const time = `${m[4].padStart(2, "0")}:${m[5]}`;
  if (diff === 0) return `Сегодня, ${time}`;
  if (diff === 1) return `Завтра, ${time}`;
  return `${WD_SHORT[d.getDay()]}, ${d.getDate()} ${MO_SHORT[d.getMonth()]}, ${time}`;
}
