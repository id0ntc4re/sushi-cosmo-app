import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { matchZoneByAddress } from "@/lib/zone-match";

// Координаты филиалов Кемерово
const BRANCH_COORDS: Record<"shahterov" | "stroiteley", { lat: number; lng: number; label: string; id: string }> = {
  shahterov: { lat: 55.3877, lng: 86.1244, label: "Проспект Шахтёров, 68", id: "00000000-0000-0000-0000-000000000001" },
  stroiteley: { lat: 55.3328, lng: 86.0758, label: "Бульвар Строителей, 21", id: "891e497e-33b8-462c-b268-c5c73245c380" },
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function extractDistrict(components: any[]): string | null {
  if (!Array.isArray(components)) return null;
  for (const c of components) {
    const name: string = c?.long_name ?? "";
    if (/район/i.test(name)) return name;
  }
  for (const c of components) {
    const types: string[] = c?.types ?? [];
    if (types.includes("administrative_area_level_3") || types.includes("sublocality_level_1")) {
      return c?.long_name ?? null;
    }
  }
  return null;
}

async function geocode(address: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
    return { ok: false as const, reason: "no_credentials" as const };
  }
  const q = /кемеров/i.test(address) ? address : `${address}, Кемерово, Россия`;
  const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=ru&language=ru`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      },
    });
  } catch {
    return { ok: false as const, reason: "network" as const };
  }
  if (!res.ok) return { ok: false as const, reason: `http_${res.status}` as const };
  const json: any = await res.json();
  const first = json?.results?.[0];
  const loc = first?.geometry?.location;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    return { ok: false as const, reason: "no_match" as const };
  }
  const formatted: string = first.formatted_address ?? "";
  if (!/Кемерово/i.test(formatted)) {
    return { ok: false as const, reason: "out_of_city" as const, formatted };
  }
  const district = extractDistrict(first.address_components ?? []);
  return { ok: true as const, lat: loc.lat as number, lng: loc.lng as number, formatted, district };
}

const inputSchema = z.object({
  address: z.string().trim().min(3).max(300),
});

export const detectBranchByAddress = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const g = await geocode(data.address);
    if (!g.ok) return g;
    const point = { lat: g.lat, lng: g.lng };
    const dSh = haversineKm(point, BRANCH_COORDS.shahterov);
    const dSt = haversineKm(point, BRANCH_COORDS.stroiteley);
    const key: "shahterov" | "stroiteley" = dSh <= dSt ? "shahterov" : "stroiteley";
    return {
      ok: true as const,
      branchKey: key,
      branchId: BRANCH_COORDS[key].id,
      label: BRANCH_COORDS[key].label,
      distanceKm: Math.round((key === "shahterov" ? dSh : dSt) * 10) / 10,
      formatted: g.formatted,
      district: g.district,
    };
  });

export const resolveDeliveryZoneByAddress = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const g = await geocode(data.address);
    if (!g.ok) return g;

    const { data: rows } = await supabaseAdmin
      .from("delivery_zones")
      .select("id,name,cost,free_from,min_order,center_lat,center_lng,radius_km")
      .eq("is_active", true)
      .order("sort_order");

    const zones = (rows ?? []) as Array<{
      id: string; name: string; cost: number; free_from: number | null; min_order: number;
      center_lat: number | null; center_lng: number | null; radius_km: number | null;
    }>;

    const point = { lat: g.lat, lng: g.lng };
    type Match = { zone: typeof zones[number]; distanceKm: number };
    const matches: Match[] = [];
    for (const z of zones) {
      if (z.center_lat == null || z.center_lng == null || !z.radius_km) continue;
      const d = haversineKm(point, { lat: z.center_lat, lng: z.center_lng });
      if (d <= Number(z.radius_km)) matches.push({ zone: z, distanceKm: d });
    }
    if (!matches.length) {
      return { ok: false as const, reason: "no_zone" as const, formatted: g.formatted };
    }
    // Берём зону с наименьшим радиусом (наиболее «точную»), при равенстве — ближайший центр
    matches.sort((a, b) =>
      (Number(a.zone.radius_km) - Number(b.zone.radius_km)) || (a.distanceKm - b.distanceKm),
    );
    const m = matches[0];
    return {
      ok: true as const,
      zoneId: m.zone.id,
      zoneName: m.zone.name,
      cost: Number(m.zone.cost),
      freeFrom: m.zone.free_from == null ? null : Number(m.zone.free_from),
      minOrder: Number(m.zone.min_order),
      formatted: g.formatted,
      distanceKm: Math.round(m.distanceKm * 10) / 10,
    };
  });

// Умное определение зоны: сначала по тексту, при неоднозначности —
// геокодируем и уточняем по району Кемерово.
export const resolveZoneSmart = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: rows } = await supabaseAdmin
      .from("delivery_zones")
      .select("id,name,cost,free_from,min_order,streets,districts")
      .eq("is_active", true)
      .order("sort_order");

    const zones = ((rows ?? []) as any[]).map((z) => ({
      id: z.id as string,
      name: z.name as string,
      cost: Number(z.cost),
      free_from: z.free_from == null ? null : Number(z.free_from),
      min_order: Number(z.min_order),
      streets: (z.streets ?? null) as string | null,
      districts: (z.districts ?? null) as string[] | null,
    }));

    const text = matchZoneByAddress(data.address, zones);
    if (text && !text.ambiguous) {
      return {
        ok: true as const,
        zoneId: text.zone.id,
        zoneName: text.zone.name,
        cost: text.zone.cost,
        freeFrom: text.zone.free_from,
        minOrder: text.zone.min_order,
        matchedStreet: text.matchedStreet,
        district: null as string | null,
        source: "text" as const,
      };
    }

    const g = await geocode(data.address);
    if (!g.ok) {
      if (text) {
        return {
          ok: true as const,
          zoneId: text.zone.id,
          zoneName: text.zone.name,
          cost: text.zone.cost,
          freeFrom: text.zone.free_from,
          minOrder: text.zone.min_order,
          matchedStreet: text.matchedStreet,
          district: null,
          source: "text_ambiguous" as const,
        };
      }
      return { ok: false as const, reason: g.reason };
    }

    const refined = matchZoneByAddress(data.address, zones, g.district);
    if (refined) {
      return {
        ok: true as const,
        zoneId: refined.zone.id,
        zoneName: refined.zone.name,
        cost: refined.zone.cost,
        freeFrom: refined.zone.free_from,
        minOrder: refined.zone.min_order,
        matchedStreet: refined.matchedStreet,
        district: g.district,
        source: refined.ambiguous ? ("geocode_ambiguous" as const) : ("geocode_district" as const),
      };
    }
    return { ok: false as const, reason: "no_zone" as const, district: g.district };
  });


