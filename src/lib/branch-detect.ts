// Автоопределение филиала по адресу клиента (Кемерово).
// Возвращает ключ филиала: "shahterov" | "stroiteley" | null.

const SHAHTEROV_KEYWORDS = [
  "шахтёр", "шахтер",
  "рудничн", "кировск",
  "лесная поляна", "лесной поляны",
  "андреевк", "солнечн", "боров", "бутовск",
  "журавлёв", "журавлев", "журавлёво", "журавлево",
  "кедровк", "промышленновск",
  "верхотомск", "берёзовск", "березовск",
];

const STROITELEY_KEYWORDS = [
  "строител", "бульвар",
  "ленинск", "центральн",
  "фпк", "металлплощад", "сухово",
  "южн", "аэропорт",
  "завокзальн", "новостройк",
  "пионер", "ягуновск",
  "берёзово", "березово", "пугач",
  "мазурово", "мозжух", "ясногорск",
];

export type BranchKey = "shahterov" | "stroiteley";

export function detectBranchKey(address: string): BranchKey | null {
  const s = address.toLowerCase().trim();
  if (s.length < 3) return null;
  const sh = SHAHTEROV_KEYWORDS.some((k) => s.includes(k));
  const st = STROITELEY_KEYWORDS.some((k) => s.includes(k));
  if (sh && !st) return "shahterov";
  if (st && !sh) return "stroiteley";
  return null;
}

export function branchKeyFromName(name: string): BranchKey | null {
  const n = name.toLowerCase();
  if (n.includes("шахт")) return "shahterov";
  if (n.includes("строит") || n.includes("бульвар")) return "stroiteley";
  return null;
}
