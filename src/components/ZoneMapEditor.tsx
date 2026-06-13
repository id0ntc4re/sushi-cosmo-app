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
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (mapsPromise) return mapsPromise;
  if (!MAPS_KEY) return Promise.reject(new Error("no_browser_key"));
  mapsPromise = new Promise<void>((resolve, reject) => {
    window.__zoneMapInit = () => resolve();
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key: MAPS_KEY,
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
const RED = "#ef4444";
const GREY = "#94a3b8";

export default function ZoneMapEditor({
  open, onClose, zoneName, initialPolygon, allZones, onSave,
}: {
  open: boolean;
  onClose: () => void;
  zoneName: string;
  initialPolygon: LatLng[] | null;
  allZones: Array<{ id: string; name: string; polygon: LatLng[] | null }>;
  onSave: (poly: LatLng[] | null) => Promise<void> | void;
}) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polyRef = useRef<any>(null);          // готовый полигон (editable)
  const drawPolylineRef = useRef<any>(null);  // линия во время рисования
  const drawMarkersRef = useRef<any[]>([]);   // маркеры-вершины при рисовании
  const draftPathRef = useRef<LatLng[]>([]);
  const clickListenerRef = useRef<any>(null);
  const dblListenerRef = useRef<any>(null);
  const otherPolysRef = useRef<any[]>([]);

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"draw" | "edit">(initialPolygon && initialPolygon.length >= 3 ? "edit" : "draw");
  const [draftCount, setDraftCount] = useState(0);

  function clearDraft() {
    if (drawPolylineRef.current) { drawPolylineRef.current.setMap(null); drawPolylineRef.current = null; }
    drawMarkersRef.current.forEach((m) => m.setMap(null));
    drawMarkersRef.current = [];
    draftPathRef.current = [];
    setDraftCount(0);
  }

  function startDrawing(map: any) {
    const g = (window as any).google;
    clearDraft();
    if (clickListenerRef.current) g.maps.event.removeListener(clickListenerRef.current);
    if (dblListenerRef.current) g.maps.event.removeListener(dblListenerRef.current);

    drawPolylineRef.current = new g.maps.Polyline({
      map,
      path: [],
      strokeColor: RED,
      strokeWeight: 2,
      strokeOpacity: 0.9,
      clickable: false,
    });

    clickListenerRef.current = g.maps.event.addListener(map, "click", (e: any) => {
      const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      draftPathRef.current.push(pt);
      drawPolylineRef.current.getPath().push(e.latLng);
      const marker = new g.maps.Marker({
        position: pt, map,
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 5, fillColor: RED, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 1.5 },
        clickable: false,
      });
      drawMarkersRef.current.push(marker);
      setDraftCount(draftPathRef.current.length);
    });

    dblListenerRef.current = g.maps.event.addListener(map, "dblclick", () => finishDrawing(map));
    map.setOptions({ disableDoubleClickZoom: true });
  }

  function finishDrawing(map: any) {
    const g = (window as any).google;
    if (draftPathRef.current.length < 3) return;
    const path = draftPathRef.current.slice();
    clearDraft();
    if (clickListenerRef.current) { g.maps.event.removeListener(clickListenerRef.current); clickListenerRef.current = null; }
    if (dblListenerRef.current) { g.maps.event.removeListener(dblListenerRef.current); dblListenerRef.current = null; }
    map.setOptions({ disableDoubleClickZoom: false });

    if (polyRef.current) polyRef.current.setMap(null);
    polyRef.current = new g.maps.Polygon({
      map, paths: path,
      strokeColor: RED, strokeWeight: 2, strokeOpacity: 0.9,
      fillColor: RED, fillOpacity: 0.18,
      editable: true, draggable: true,
    });
    setMode("edit");
  }

  function restartDrawing() {
    if (polyRef.current) { polyRef.current.setMap(null); polyRef.current = null; }
    setMode("draw");
    if (mapRef.current) startDrawing(mapRef.current);
  }

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
        clickableIcons: false,
      });
      mapRef.current = map;

      // соседние зоны — серые
      for (const z of allZones) {
        if (!z.polygon || z.polygon.length < 3) continue;
        const p = new g.maps.Polygon({
          map, paths: z.polygon,
          strokeColor: GREY, strokeOpacity: 0.8, strokeWeight: 1,
          fillColor: GREY, fillOpacity: 0.12, clickable: false,
        });
        otherPolysRef.current.push(p);
      }

      if (initialPolygon && initialPolygon.length >= 3) {
        polyRef.current = new g.maps.Polygon({
          map, paths: initialPolygon,
          strokeColor: RED, strokeWeight: 2, strokeOpacity: 0.9,
          fillColor: RED, fillOpacity: 0.18,
          editable: true, draggable: true,
        });
        const b = new g.maps.LatLngBounds();
        initialPolygon.forEach((pt: LatLng) => b.extend(pt));
        map.fitBounds(b);
        setMode("edit");
      } else {
        startDrawing(map);
      }
    }).catch((e) => setErr(e.message ?? "Не удалось загрузить карту"));

    return () => {
      cancelled = true;
      const g = (window as any).google;
      if (clickListenerRef.current && g?.maps?.event) g.maps.event.removeListener(clickListenerRef.current);
      if (dblListenerRef.current && g?.maps?.event) g.maps.event.removeListener(dblListenerRef.current);
      clickListenerRef.current = null;
      dblListenerRef.current = null;
      clearDraft();
      if (polyRef.current) { polyRef.current.setMap(null); polyRef.current = null; }
      otherPolysRef.current.forEach((p) => p.setMap(null));
      otherPolysRef.current = [];
      mapRef.current = null;
    };
  }, [open, initialPolygon, allZones]);

  async function save() {
    setBusy(true);
    try {
      let poly: LatLng[] | null = null;
      const p = polyRef.current;
      if (p && typeof p.getPath === "function") {
        const path = p.getPath();
        const pts: LatLng[] = [];
        for (let i = 0; i < path.getLength(); i++) {
          const pt = path.getAt(i);
          pts.push({ lat: pt.lat(), lng: pt.lng() });
        }
        if (pts.length >= 3) poly = pts;
      } else if (draftPathRef.current.length >= 3) {
        poly = draftPathRef.current.slice();
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
            <p className="text-xs text-neutral-500">
              {mode === "draw"
                ? "Кликайте по карте, ставя точки вдоль границы зоны. Двойной клик или кнопка «Завершить» — замкнуть контур (минимум 3 точки)."
                : "Точки можно перетаскивать, добавлять — клик на пунктирной середине ребра. Перетащите всю зону за центр."}
            </p>
          </div>
          <button onClick={onClose} className="text-2xl text-neutral-400 hover:text-neutral-700">×</button>
        </div>
        {err ? (
          <div className="flex-1 flex items-center justify-center text-red-600">{err === "no_browser_key" ? "Не настроен Google Maps Browser Key" : err}</div>
        ) : (
          <div ref={mapDiv} className="flex-1" />
        )}
        <div className="px-5 py-3 border-t flex items-center gap-3">
          {mode === "draw" ? (
            <>
              <span className="text-xs text-neutral-500">Поставлено точек: <b>{draftCount}</b></span>
              <button
                onClick={() => mapRef.current && finishDrawing(mapRef.current)}
                disabled={draftCount < 3 || busy}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40"
              >
                ✓ Завершить контур
              </button>
              <button onClick={() => clearDraft()} disabled={!draftCount || busy} className="px-4 py-2 rounded-xl bg-white border text-sm font-semibold disabled:opacity-40">
                Стереть
              </button>
            </>
          ) : (
            <button onClick={restartDrawing} disabled={busy} className="px-4 py-2 rounded-xl bg-white border text-sm font-semibold">
              Нарисовать заново
            </button>
          )}
          <div className="flex-1 text-xs text-neutral-500 text-right">
            Серым — соседние зоны. Красным — текущая.
          </div>
          <button onClick={async () => { await onSave(null); onClose(); }} disabled={busy} className="px-4 py-2 rounded-xl bg-white border text-sm font-semibold text-red-500">
            Удалить полигон
          </button>
          <button onClick={save} disabled={busy || (mode === "draw" && draftCount < 3)} className="px-5 py-2 rounded-xl bg-primary text-white font-bold disabled:opacity-50">
            {busy ? "..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
