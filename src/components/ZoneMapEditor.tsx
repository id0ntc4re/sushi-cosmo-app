import { useEffect, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

declare global {
  interface Window {
    __zoneMapInit?: () => void;
    google: any;
  }
}

const MAPS_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

let mapsPromise: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).google?.maps?.drawing) return Promise.resolve();
  if (mapsPromise) return mapsPromise;
  if (!MAPS_KEY) return Promise.reject(new Error("no_browser_key"));
  mapsPromise = new Promise<void>((resolve, reject) => {
    window.__zoneMapInit = () => resolve();
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key: MAPS_KEY,
      libraries: "drawing",
      loading: "async",
      callback: "__zoneMapInit",
      ...(TRACKING ? { channel: TRACKING } : {}),
    });
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => reject(new Error("script_load_failed"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

const KEM_CENTER = { lat: 55.355, lng: 86.087 };

export default function ZoneMapEditor({
  open, onClose, zoneName, initialPolygon, allZones, onSave,
}: {
  open: boolean;
  onClose: () => void;
  zoneName: string;
  initialPolygon: LatLng[] | null;
  allZones: Array<{ id: string; name: string; polygon: LatLng[] | null; color?: string }>;
  onSave: (poly: LatLng[] | null) => Promise<void> | void;
}) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polyRef = useRef<any>(null);
  const drawingRef = useRef<any>(null);
  const otherPolysRef = useRef<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasPolygon, setHasPolygon] = useState<boolean>(!!initialPolygon?.length);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadMaps().then(() => {
      if (cancelled || !mapDiv.current) return;
      const g = (window as any).google;
      const map = new g.maps.Map(mapDiv.current, {
        center: KEM_CENTER,
        zoom: 12,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapRef.current = map;

      // Чужие зоны — серые
      otherPolysRef.current.forEach((p) => p.setMap(null));
      otherPolysRef.current = [];
      for (const z of allZones) {
        if (!z.polygon || z.polygon.length < 3) continue;
        const p = new g.maps.Polygon({
          paths: z.polygon,
          strokeColor: "#94a3b8",
          strokeOpacity: 0.8,
          strokeWeight: 1,
          fillColor: "#94a3b8",
          fillOpacity: 0.12,
          clickable: false,
        });
        p.setMap(map);
        otherPolysRef.current.push(p);
      }

      // Текущая зона
      const attachListeners = (poly: any) => {
        const path = poly.getPath();
        const refresh = () => setHasPolygon(path.getLength() >= 3);
        g.maps.event.addListener(path, "set_at", refresh);
        g.maps.event.addListener(path, "insert_at", refresh);
        g.maps.event.addListener(path, "remove_at", refresh);
      };
      if (initialPolygon && initialPolygon.length >= 3) {
        const p = new g.maps.Polygon({
          paths: initialPolygon,
          strokeColor: "#ef4444",
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: "#ef4444",
          fillOpacity: 0.18,
          editable: true,
          draggable: true,
        });
        p.setMap(map);
        polyRef.current = p;
        attachListeners(p);
        const b = new g.maps.LatLngBounds();
        initialPolygon.forEach((pt: LatLng) => b.extend(pt));
        map.fitBounds(b);
      }

      // Drawing manager — для рисования новой
      const dm = new g.maps.drawing.DrawingManager({
        drawingMode: polyRef.current ? null : g.maps.drawing.OverlayType.POLYGON,
        drawingControl: true,
        drawingControlOptions: {
          position: g.maps.ControlPosition.TOP_CENTER,
          drawingModes: [g.maps.drawing.OverlayType.POLYGON],
        },
        polygonOptions: {
          strokeColor: "#ef4444",
          strokeWeight: 2,
          fillColor: "#ef4444",
          fillOpacity: 0.18,
          editable: true,
          draggable: true,
        },
      });
      dm.setMap(map);
      drawingRef.current = dm;
      g.maps.event.addListener(dm, "polygoncomplete", (poly: any) => {
        if (polyRef.current) polyRef.current.setMap(null);
        polyRef.current = poly;
        attachListeners(poly);
        setHasPolygon(true);
        dm.setDrawingMode(null);
      });
    }).catch((e) => setErr(e.message ?? "Не удалось загрузить карту"));
    return () => {
      cancelled = true;
      if (polyRef.current) { polyRef.current.setMap(null); polyRef.current = null; }
      otherPolysRef.current.forEach((p) => p.setMap(null));
      otherPolysRef.current = [];
      if (drawingRef.current) { drawingRef.current.setMap(null); drawingRef.current = null; }
      mapRef.current = null;
    };
  }, [open, initialPolygon, allZones]);

  function clearPolygon() {
    if (polyRef.current) { polyRef.current.setMap(null); polyRef.current = null; }
    setHasPolygon(false);
    if (drawingRef.current) {
      const g = (window as any).google;
      drawingRef.current.setDrawingMode(g.maps.drawing.OverlayType.POLYGON);
    }
  }

  async function save() {
    setBusy(true);
    try {
      let poly: LatLng[] | null = null;
      if (polyRef.current) {
        const path = polyRef.current.getPath();
        const pts: LatLng[] = [];
        for (let i = 0; i < path.getLength(); i++) {
          const p = path.getAt(i);
          pts.push({ lat: p.lat(), lng: p.lng() });
        }
        if (pts.length >= 3) poly = pts;
      }
      await onSave(poly);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-lg">Зона на карте · {zoneName}</h3>
            <p className="text-xs text-neutral-500">Нарисуйте контур зоны: кликайте по точкам на карте, замкните полигон двойным кликом. Точки можно перетаскивать.</p>
          </div>
          <button onClick={onClose} className="text-2xl text-neutral-400 hover:text-neutral-700">×</button>
        </div>
        {err ? (
          <div className="flex-1 flex items-center justify-center text-red-600">{err === "no_browser_key" ? "Не настроен Google Maps Browser Key" : err}</div>
        ) : (
          <div ref={mapDiv} className="flex-1" />
        )}
        <div className="px-5 py-3 border-t flex items-center gap-3">
          <button onClick={clearPolygon} disabled={!hasPolygon || busy} className="px-4 py-2 rounded-xl bg-white border text-sm font-semibold disabled:opacity-40">
            Очистить и нарисовать заново
          </button>
          <div className="flex-1 text-xs text-neutral-500">
            Серым — соседние зоны. Красным — текущая.
          </div>
          <button onClick={() => onSave(null).then(onClose)} disabled={busy} className="px-4 py-2 rounded-xl bg-white border text-sm font-semibold text-red-500">
            Удалить полигон
          </button>
          <button onClick={save} disabled={busy} className="px-5 py-2 rounded-xl bg-primary text-white font-bold disabled:opacity-50">
            {busy ? "..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
