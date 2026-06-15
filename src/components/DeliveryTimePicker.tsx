import { useMemo, useState } from "react";
import { Clock, CalendarClock, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  leadMin?: number;
};

const WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MO = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function stripTime(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtDate(d: Date, today: Date) {
  const diff = Math.round((stripTime(d).getTime() - stripTime(today).getTime()) / 86400000);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  return `${WD[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()]}`;
}

// Serialise: "YYYY-MM-DD HH:MM"
function parseValue(v: string): { date: Date | null; time: string } {
  if (!v) return { date: null, time: "" };
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{1,2}:\d{2})$/);
  if (!m) return { date: null, time: "" };
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return { date: d, time: m[4] };
}

function serialise(d: Date, time: string) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da} ${time}`;
}

export function DeliveryTimePicker({ value, onChange, leadMin = 60 }: Props) {
  const today = useMemo(() => new Date(), []);
  const parsed = useMemo(() => parseValue(value), [value]);
  const mode: "asap" | "scheduled" = value ? "scheduled" : "asap";

  const [open, setOpen] = useState(false);
  const [timeDraft, setTimeDraft] = useState(parsed.time);

  function setMode(m: "asap" | "scheduled") {
    if (m === "asap") {
      onChange("");
      setTimeDraft("");
    } else {
      const d = new Date(today.getTime() + leadMin * 60000);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const t = `${hh}:${mm}`;
      setTimeDraft(t);
      onChange(serialise(stripTime(today), t));
    }
  }

  function pickDate(d: Date | undefined) {
    if (!d) return;
    const t = timeDraft || "12:00";
    setTimeDraft(t);
    onChange(serialise(d, t));
    setOpen(false);
  }

  function onTimeChange(raw: string) {
    let v = raw.replace(/[^\d:]/g, "").slice(0, 5);
    if (v.length === 2 && !v.includes(":")) v = v + ":";
    setTimeDraft(v);
    const m = v.match(/^(\d{2}):(\d{2})$/);
    if (m) {
      const h = Math.min(23, Number(m[1]));
      const min = Math.min(59, Number(m[2]));
      const fixed = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      const date = parsed.date ?? stripTime(today);
      onChange(serialise(date, fixed));
    }
  }

  // Past-time guard
  const selectedDateTime = useMemo(() => {
    if (!parsed.date) return null;
    const m = timeDraft.match(/^(\d{2}):(\d{2})$/);
    if (!m) return null;
    const d = new Date(parsed.date);
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d;
  }, [parsed.date, timeDraft]);
  const isPast = selectedDateTime ? selectedDateTime.getTime() < Date.now() : false;

  const displayDate = parsed.date ?? stripTime(today);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-100 rounded-xl">
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

      {mode === "scheduled" && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "h-11 px-3 rounded-xl bg-white border border-neutral-200 flex items-center gap-2 text-sm font-semibold text-left hover:border-neutral-300 transition",
                )}
              >
                <CalendarIcon className="w-4 h-4 text-neutral-500" />
                <span className="flex-1 truncate">{fmtDate(displayDate, today)}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0 pointer-events-auto">
              <Calendar
                mode="single"
                selected={parsed.date ?? undefined}
                onSelect={pickDate}
                disabled={{ before: stripTime(today) }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <div className="relative">
            <Clock className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              inputMode="numeric"
              placeholder="ЧЧ:ММ"
              value={timeDraft}
              onChange={(e) => onTimeChange(e.target.value)}
              className="h-11 w-28 pl-9 pr-3 rounded-xl bg-white border border-neutral-200 text-sm font-semibold tabular-nums focus:outline-none focus:border-primary"
            />
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
