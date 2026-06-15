import { useMemo } from "react";
import { Clock, CalendarClock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  value: string;
  onChange: (v: string) => void;
  leadMin?: number;
  startHour?: number;
  endHour?: number;
};

const WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function dayLabel(d: Date, today: Date) {
  const diff = Math.round((stripTime(d).getTime() - stripTime(today).getTime()) / 86400000);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${WD[d.getDay()]}, ${dd}.${mm}`;
}

function stripTime(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function buildTimes(date: Date, today: Date, leadMin: number, startHour: number, endHour: number) {
  const isToday = stripTime(date).getTime() === stripTime(today).getTime();
  let start = new Date(date);
  start.setHours(startHour, 0, 0, 0);
  if (isToday) {
    const earliest = new Date(today.getTime() + leadMin * 60000);
    const m = earliest.getMinutes();
    earliest.setMinutes(m <= 30 ? 30 : 60, 0, 0);
    if (earliest > start) start = earliest;
  }
  const end = new Date(date);
  end.setHours(endHour, 0, 0, 0);
  const out: string[] = [];
  for (let t = new Date(start); t < end; t = new Date(t.getTime() + 30 * 60000)) {
    out.push(`${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`);
  }
  return out;
}

export function DeliveryTimePicker({
  value,
  onChange,
  leadMin = 60,
  startHour = 10,
  endHour = 22,
}: Props) {
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => {
    const arr: { key: string; label: string; date: Date; times: string[] }[] = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const times = buildTimes(d, today, leadMin, startHour, endHour);
      if (!times.length) continue;
      arr.push({ key: `d${i}`, label: dayLabel(d, today), date: d, times });
    }
    return arr;
  }, [today, leadMin, startHour, endHour]);

  // Parse current value: "<dayLabel> HH:MM"
  const parsed = useMemo(() => {
    if (!value) return { day: "", time: "" };
    const m = value.match(/^(.*)\s(\d{2}:\d{2})$/);
    if (!m) return { day: "", time: "" };
    return { day: m[1], time: m[2] };
  }, [value]);

  const mode: "asap" | "scheduled" = value ? "scheduled" : "asap";
  const activeDay = days.find((d) => d.label === parsed.day) ?? days[0];

  function setMode(m: "asap" | "scheduled") {
    if (m === "asap") onChange("");
    else if (days.length) {
      const d = days[0];
      onChange(`${d.label} ${d.times[0]}`);
    }
  }
  function setDay(label: string) {
    const d = days.find((x) => x.label === label);
    if (!d) return;
    const t = d.times.includes(parsed.time) ? parsed.time : d.times[0];
    onChange(`${d.label} ${t}`);
  }
  function setTime(t: string) {
    const d = activeDay;
    if (!d) return;
    onChange(`${d.label} ${t}`);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 rounded-xl">
        <button
          type="button"
          onClick={() => setMode("asap")}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${
            mode === "asap" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          <Clock className="w-4 h-4" />
          На ближайшее время
        </button>
        <button
          type="button"
          onClick={() => setMode("scheduled")}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${
            mode === "scheduled" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          Выбрать время
        </button>
      </div>

      {mode === "scheduled" && activeDay && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[11px] font-semibold text-neutral-500 mb-1 ml-1">Дата</div>
            <Select value={activeDay.label} onValueChange={setDay}>
              <SelectTrigger className="h-11 rounded-xl bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {days.map((d) => (
                  <SelectItem key={d.key} value={d.label} className="py-2.5">
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-neutral-500 mb-1 ml-1">Время</div>
            <Select value={parsed.time || activeDay.times[0]} onValueChange={setTime}>
              <SelectTrigger className="h-11 rounded-xl bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {activeDay.times.map((t) => (
                  <SelectItem key={t} value={t} className="py-2.5 font-mono">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {mode === "asap" && (
        <p className="text-xs text-neutral-500 ml-1">
          Заказ будет готов как можно скорее (≈ {leadMin} мин).
        </p>
      )}
    </div>
  );
}
