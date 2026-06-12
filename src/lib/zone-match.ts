// Сопоставление адреса со списком зон доставки по названиям улиц.
// Никакого геокодинга — простая текстовая проверка вхождения.

export type ZoneLike = {
  id: string;
  name: string;
  streets: string | null;
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

// Возвращает совпавшую зону по адресу либо null.
export function matchZoneByAddress<T extends ZoneLike>(
  address: string,
  zones: T[],
): { zone: T; matchedStreet: string } | null {
  const addrTokens = tokensOf(address);
  if (!addrTokens.length) return null;
  const addrSet = new Set(addrTokens);
  const addrJoined = " " + addrTokens.join(" ") + " ";

  for (const z of zones) {
    const list = (z.streets || "")
      .split(/[\n,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    for (const street of list) {
      const sTokens = tokensOf(street);
      if (!sTokens.length) continue;
      // Все значащие слова улицы должны встретиться в адресе.
      // Для многословных улиц дополнительно проверяем последовательность слов.
      const allPresent = sTokens.every((t) => addrSet.has(t));
      if (!allPresent) continue;
      if (sTokens.length === 1) {
        return { zone: z, matchedStreet: street };
      }
      const seq = " " + sTokens.join(" ") + " ";
      if (addrJoined.includes(seq)) {
        return { zone: z, matchedStreet: street };
      }
    }
  }
  return null;
}
