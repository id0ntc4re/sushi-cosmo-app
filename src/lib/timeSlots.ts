// Generates delivery time slots in 30-min steps, starting +60 min from now
export function getDeliverySlots(opts?: { startHour?: number; endHour?: number; leadMin?: number }) {
  const startHour = opts?.startHour ?? 10;
  const endHour = opts?.endHour ?? 22;
  const lead = opts?.leadMin ?? 60;

  const now = new Date();
  const earliest = new Date(now.getTime() + lead * 60000);
  // round up to next :00 or :30
  const m = earliest.getMinutes();
  earliest.setMinutes(m <= 30 ? 30 : 60, 0, 0);

  const slots: { value: string; label: string }[] = [];
  const cursor = new Date(earliest);

  for (let day = 0; day < 2 && slots.length < 30; day++) {
    const isToday = day === 0;
    const dayStart = new Date(cursor);
    if (!isToday) {
      dayStart.setDate(dayStart.getDate() + 1);
      dayStart.setHours(startHour, 0, 0, 0);
    }
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(endHour, 0, 0, 0);

    let t = new Date(dayStart);
    if (t.getHours() < startHour) t.setHours(startHour, 0, 0, 0);

    while (t < dayEnd) {
      const hh = String(t.getHours()).padStart(2, "0");
      const mm = String(t.getMinutes()).padStart(2, "0");
      const time = `${hh}:${mm}`;
      const prefix = isToday ? "Сегодня" : "Завтра";
      slots.push({ value: `${prefix} ${time}`, label: `${prefix}, ${time}` });
      t = new Date(t.getTime() + 30 * 60000);
    }
  }
  return slots;
}
