import { useEffect, useRef, useState } from "react";

type Parts = { street: string; house: string; entrance: string; floor: string; apartment: string };
const empty: Parts = { street: "", house: "", entrance: "", floor: "", apartment: "" };

export function parseAddress(s: string): Parts {
  if (!s) return { ...empty };
  const p = { ...empty };
  let rest = s.replace(/^\[[^\]]+\]\s*/, "").trim();

  const ent = rest.match(/,?\s*подъезд\s*([^,]+)/i);
  if (ent) { p.entrance = ent[1].trim(); rest = rest.replace(ent[0], ""); }

  const fl = rest.match(/,?\s*эта?ж\s*\.?\s*([^,]+)/i);
  if (fl) { p.floor = fl[1].trim(); rest = rest.replace(fl[0], ""); }

  const apt = rest.match(/,?\s*(?:кв\.?|квартира|оф(?:ис)?\.?)\s*([^,]+)/i);
  if (apt) { p.apartment = apt[1].trim(); rest = rest.replace(apt[0], ""); }

  const h = rest.match(/,?\s*д(?:ом)?\.?\s*([0-9][0-9A-Za-zА-Яа-я\/\-]*)/i);
  if (h) {
    p.house = h[1].trim();
    rest = rest.replace(h[0], "");
  } else {
    const segs = rest.split(",").map((x) => x.trim()).filter(Boolean);
    if (segs.length >= 2 && /\d/.test(segs[segs.length - 1])) {
      p.house = segs.pop()!.trim();
      rest = segs.join(", ");
    }
  }
  p.street = rest.replace(/\s*,\s*,\s*/g, ", ").replace(/^[,\s]+|[,\s]+$/g, "").trim();
  return p;
}

export function combineAddress(p: Parts): string {
  const out: string[] = [];
  if (p.street.trim()) out.push(p.street.trim());
  if (p.house.trim()) out.push(`д. ${p.house.trim()}`);
  if (p.entrance.trim()) out.push(`подъезд ${p.entrance.trim()}`);
  if (p.floor.trim()) out.push(`этаж ${p.floor.trim()}`);
  if (p.apartment.trim()) out.push(`кв. ${p.apartment.trim()}`);
  return out.join(", ");
}

export function AddressFields({
  value,
  onChange,
  required,
  inputClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  inputClassName?: string;
}) {
  const [parts, setParts] = useState<Parts>(() => parseAddress(value));
  const lastEmitted = useRef<string>(combineAddress(parts));

  useEffect(() => {
    if ((value ?? "") !== lastEmitted.current) {
      const parsed = parseAddress(value ?? "");
      setParts(parsed);
      lastEmitted.current = value ?? "";
    }
  }, [value]);

  function update(patch: Partial<Parts>) {
    const next = { ...parts, ...patch };
    setParts(next);
    const combined = combineAddress(next);
    lastEmitted.current = combined;
    onChange(combined);
  }

  const cls = inputClassName ?? "w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-primary";
  const lab = "block text-[11px] font-semibold text-neutral-500 mb-1 uppercase tracking-wide";

  return (
    <div className="space-y-2">
      <label className="block">
        <span className={lab}>Улица{required ? " *" : ""}</span>
        <input
          className={cls}
          placeholder="напр. ул. Ленина"
          value={parts.street}
          onChange={(e) => update({ street: e.target.value })}
          required={required}
        />
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="block">
          <span className={lab}>Дом{required ? " *" : ""}</span>
          <input
            className={cls}
            placeholder="12А"
            value={parts.house}
            onChange={(e) => update({ house: e.target.value })}
            required={required}
          />
        </label>
        <label className="block">
          <span className={lab}>Подъезд</span>
          <input
            className={cls}
            placeholder="2"
            value={parts.entrance}
            onChange={(e) => update({ entrance: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={lab}>Этаж</span>
          <input
            className={cls}
            placeholder="5"
            value={parts.floor}
            onChange={(e) => update({ floor: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={lab}>Кв./офис</span>
          <input
            className={cls}
            placeholder="34"
            value={parts.apartment}
            onChange={(e) => update({ apartment: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
