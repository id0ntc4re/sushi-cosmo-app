import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Координаты филиалов Кемерово
const BRANCH_COORDS: Record<"shahterov" | "stroiteley", { lat: number; lng: number; label: string }> = {
  shahterov: { lat: 55.3877, lng: 86.1244, label: "Проспект Шахтёров, 68" },
  stroiteley: { lat: 55.3328, lng: 86.0758, label: "Бульвар Строителей, 21" },
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

const inputSchema = z.object({
  address: z.string().trim().min(3).max(300),
});

export const detectBranchByAddress = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return { ok: false as const, reason: "no_credentials" };
    }

    // Добавим "Кемерово", если не указано — улучшает точность геокодинга
    const q = /кемеров/i.test(data.address) ? data.address : `${data.address}, Кемерово, Россия`;

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
      return { ok: false as const, reason: "network" };
    }
    if (!res.ok) return { ok: false as const, reason: `http_${res.status}` };
    const json: any = await res.json();
    const loc = json?.results?.[0]?.geometry?.location;
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
      return { ok: false as const, reason: "no_match" };
    }

    // Проверим, что результат в Кемерово (бывает Кемеровская область далеко)
    const formatted: string = json.results[0].formatted_address ?? "";
    if (!/Кемерово/i.test(formatted)) {
      return { ok: false as const, reason: "out_of_city", formatted };
    }

    const point = { lat: loc.lat, lng: loc.lng };
    const dSh = haversineKm(point, BRANCH_COORDS.shahterov);
    const dSt = haversineKm(point, BRANCH_COORDS.stroiteley);
    const key: "shahterov" | "stroiteley" = dSh <= dSt ? "shahterov" : "stroiteley";

    return {
      ok: true as const,
      branchKey: key,
      label: BRANCH_COORDS[key].label,
      distanceKm: Math.round((key === "shahterov" ? dSh : dSt) * 10) / 10,
      formatted,
    };
  });
