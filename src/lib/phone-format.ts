export function formatRuPhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (!digits.startsWith("7")) digits = "7" + digits;
  digits = digits.slice(0, 11);
  const p = digits.slice(1);
  let out = "+7";
  if (p.length > 0) out += " (" + p.slice(0, 3);
  if (p.length >= 3) out += ")";
  if (p.length >= 4) out += " " + p.slice(3, 6);
  if (p.length >= 7) out += "-" + p.slice(6, 8);
  if (p.length >= 9) out += "-" + p.slice(8, 10);
  return out;
}

export function isValidRuPhone(input: string): boolean {
  const d = input.replace(/\D/g, "");
  return d.length === 11 && (d.startsWith("7") || d.startsWith("8"));
}

export function isValidName(input: string): boolean {
  const v = input.trim();
  if (v.length < 2 || v.length > 50) return false;
  return /^[A-Za-zА-Яа-яЁё\s-]+$/.test(v);
}
