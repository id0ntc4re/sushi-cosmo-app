// Сопоставление адреса со списком зон доставки по названиям улиц.
// Поддерживает уточнение по району Кемерово, когда улица проходит
// через несколько районов (приходит из геокодера).

export type ZoneLike = {
  id: string;
  name: string;
  streets: string | null;
  districts?: string[] | null;
};

// Нормализация: нижний регистр, ё→е, схлопывание пробелов и пунктуации.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^а-яa-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Часто встречающиеся префиксы/суффиксы названий улиц, которые игнорируем.
const STREET_TOKENS = new Set([
  "ул", "улица", "пр", "пр-кт", "проспект", "пер", "переулок",
  "б", "бул", "бульвар", "ш", "шоссе", "пл", "площадь",
  "мкр", "микрорайон", "р-н", "район", "проезд", "тракт", "наб", "набережная",
  "стр", "строение", "к", "корп", "корпус", "д", "дом", "кв", "квартира",
  "г", "город", "обл", "область",
]);

function tokensOf(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t && !STREET_TOKENS.has(t) && !/^\d+[а-я]?$/.test(t));
}

// Нормализуем район: «Ленинский район» → «ленинский».
export function normalizeDistrict(s: string): string {
  return normalize(s).replace(/\s*район\s*$/i, "").trim();
}

type MatchInternal<T> = { zone: T; matchedStreet: string };

function findAllMatches<T extends ZoneLike>(address: string, zones: T[]): MatchInternal<T>[] {
  const addrTokens = tokensOf(address);
  if (!addrTokens.length) return [];
  const addrSet = new Set(addrTokens);
  const addrJoined = " " + addrTokens.join(" ") + " ";

  const out: MatchInternal<T>[] = [];
  for (const z of zones) {
    const list = (z.streets || "")
      .split(/[\n,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    for (const street of list) {
      const sTokens = tokensOf(street);
      if (!sTokens.length) continue;
      const allPresent = sTokens.every((t) => addrSet.has(t));
      if (!allPresent) continue;
      if (sTokens.length === 1) {
        out.push({ zone: z, matchedStreet: street });
        break;
      }
      const seq = " " + sTokens.join(" ") + " ";
      if (addrJoined.includes(seq)) {
        out.push({ zone: z, matchedStreet: street });
        break;
      }
    }
  }
  return out;
}

// Возвращает совпавшую зону по адресу либо null.
// Если передан districtHint и есть несколько совпадений по улице — фильтрует
// по районам зоны; если по району осталось ровно одно — возвращает его.
export function matchZoneByAddress<T extends ZoneLike>(
  address: string,
  zones: T[],
  districtHint?: string | null,
): { zone: T; matchedStreet: string; ambiguous?: boolean } | null {
  const matches = findAllMatches(address, zones);
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];

  if (districtHint) {
    const d = normalizeDistrict(districtHint);
    const filtered = matches.filter((m) => {
      const arr = (m.zone.districts || []).map(normalizeDistrict);
      return arr.includes(d);
    });
    if (filtered.length === 1) return filtered[0];
    if (filtered.length > 1) return { ...filtered[0], ambiguous: true };
  }
  return { ...matches[0], ambiguous: true };
}
