export type Tier = "bronze" | "silver" | "gold";

export const TIERS: Record<Tier, { label: string; min: number; discount: number; cashback: number; color: string }> = {
  bronze: { label: "Бронза", min: 0, discount: 0, cashback: 3, color: "#cd7f32" },
  silver: { label: "Серебро", min: 10000, discount: 3, cashback: 5, color: "#9ca3af" },
  gold: { label: "Золото", min: 30000, discount: 7, cashback: 10, color: "#eab308" },
};

export function tierFromTotal(total: number): Tier {
  if (total >= TIERS.gold.min) return "gold";
  if (total >= TIERS.silver.min) return "silver";
  return "bronze";
}

export function nextTier(t: Tier): { tier: Tier; need: number } | null {
  if (t === "bronze") return { tier: "silver", need: TIERS.silver.min };
  if (t === "silver") return { tier: "gold", need: TIERS.gold.min };
  return null;
}
