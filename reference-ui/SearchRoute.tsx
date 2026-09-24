"use client";
import { useEffect, useId, useState, useRef } from "react";
import type { Airport } from "../validation/index";
import boundaries from "./route-boundaries.json";

type Coordinates = Record<string, number[]>;
type MapPoint = {
  code: string;
  city: string;
  latitude: number;
  longitude: number;
};
function AnimatedFlight({ path, start, end, onComplete }: { path: string; start: number[]; end: number[]; onComplete?: () => void }) {
  const line = useRef<SVGPathElement>(null);
  const plane = useRef<SVGGElement>(null);
  const departure = useRef<SVGCircleElement>(null);
  const arrival = useRef<SVGCircleElement>(null);
  useEffect(() => {
    const route = line.current, aircraft = plane.current;
    if (!route || !aircraft) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const finish = () => { cancelAnimationFrame(frame); route.style.strokeDashoffset = "0"; aircraft.style.opacity = "0"; if (departure.current) departure.current.style.opacity = "0"; if (arrival.current) arrival.current.style.opacity = "0"; onComplete?.(); };
    if (reduced.matches) { finish(); return; }
    const length = route.getTotalLength(), began = performance.now();
    const tick = (now: number) => {
      const elapsed = now - began;
      const progress = Math.max(0, Math.min(1, (elapsed - 1000) / 3700));
      const point = route.getPointAtLength(progress * length);
      const before = route.getPointAtLength(Math.max(0, progress * length - 1));
      const after = route.getPointAtLength(Math.min(length, progress * length + 1));
      const angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
      aircraft.setAttribute("transform", `translate(${point.x} ${point.y}) rotate(${angle})`);
      aircraft.style.opacity = elapsed >= 1000 && elapsed < 4700 ? "1" : "0";
      route.style.strokeDashoffset = String(1 - progress);
      for (const [element, offset] of [[departure.current, 0], [arrival.current, elapsed >= 4700 ? 4700 : 500]] as const) {
        const pulse = (elapsed - offset) / 500;
        if (element) { element.style.opacity = pulse >= 0 && pulse <= 1 ? String(1-pulse) : "0"; element.setAttribute("r", String(7 + Math.max(0, Math.min(1, pulse)) * 16)); }
      }
      if (elapsed >= 5000) finish(); else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    reduced.addEventListener("change", finish);
    return () => { cancelAnimationFrame(frame); reduced.removeEventListener("change", finish); };
  }, [path, onComplete]);
  return <g aria-hidden="true">
    <path ref={line} d={path} pathLength="1" fill="none" stroke="#e7bc5e" strokeWidth="1.8" style={{strokeDasharray:1, strokeDashoffset:1}} />
    <circle ref={departure} cx={start[0]} cy={start[1]} r="7" fill="none" stroke="#e7bc5e" opacity="0" />
    <circle ref={arrival} cx={end[0]} cy={end[1]} r="7" fill="none" stroke="#e7bc5e" opacity="0" />
    <g ref={plane} className="route-moving-aircraft" opacity="0"><path d="M10 0 2 -2 -3 -8 -5 -8 -2 -1 -8 -1 -10 -4 -11 -4 -10 0 -11 4 -10 4 -8 1 -2 1 -5 8 -3 8 2 2Z" fill="#fff" stroke="#222" strokeWidth=".5" /></g>
  </g>;
}
export function SearchRoute({ from, to, date, roundTrip, onComplete, animate = false }: { from: Airport | null; to: Airport | null; date: string; roundTrip: boolean; onComplete?: () => void; animate?: boolean }) {
  const [coordinates, setCoordinates] = useState<Coordinates>({});
  const grid = useId();
  useEffect(() => { void import("./route-airports.json").then(data => setCoordinates(data.default)); }, []);
  const origin = from ? coordinates[from.code] : undefined;
  const destination = to ? coordinates[to.code] : undefined;
  useEffect(() => {
    if (animate && Object.keys(coordinates).length && from && to && (!origin || !destination)) onComplete?.();
  }, [coordinates, from, to, origin, destination, onComplete, animate]);
  const points = [origin, destination].filter((p): p is number[] => Boolean(p));
  const west = points.length ? Math.min(...points.map(p => p[0])) - 3 : -94;
  const east = points.length ? Math.max(...points.map(p => p[0])) + 3 : -78;
  const south = points.length ? Math.min(...points.map(p => p[1])) - 2 : 29;
  const north = points.length ? Math.max(...points.map(p => p[1])) + 2 : 40;
  const factor = Math.cos((north + south) / 2 * Math.PI / 180);
  const scale = Math.min(620 / ((east - west) * factor), 210 / (north - south));
  const project = ([lon, lat]: number[]) => [350 + (lon - (west + east) / 2) * factor * scale, 145 - (lat - (north + south) / 2) * scale];
  const ring = (r: number[][]) => r.map((p, i) => `${i ? "L" : "M"}${project(p).join(",")}`).join(" ") + "Z";
  const start = origin ? project(origin) : null, end = destination ? project(destination) : null;
  // Bend perpendicular to the route so short north/south trips never double back.
  const routePath = start && end ? `M${start.join(",")} Q${(start[0]+end[0])/2 + (end[1]-start[1])*.18},${(start[1]+end[1])/2 - (end[0]-start[0])*.18} ${end.join(",")}` : "";
  const code = (value: string) => value.startsWith("K") && value.length === 4 ? value.slice(1) : value;
  return <section className="search-route" aria-label="Your flight route">
    <div className="search-route-top"><span><i />Your route</span><span>{roundTrip ? "Round-trip" : "One-way"}{date ? ` · ${date}` : ""}</span></div>
    <svg viewBox="0 0 700 290" role="img" aria-label={from && to ? `Illustrative route from ${from.city} to ${to.city}` : "Choose your airports to preview the route"}>
      <defs><pattern id={grid} width="35" height="35" patternUnits="userSpaceOnUse"><path d="M35 0H0V35" fill="none" stroke="white" strokeOpacity=".035" /></pattern></defs>
      <rect width="700" height="290" fill={`url(#${grid})`} />
      {boundaries.map(feature => {
        const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates as number[][][]] : feature.geometry.coordinates as number[][][][];
        return <path key={feature.name} d={polygons.map(p => p.map(ring).join(" ")).join(" ")} fill={feature.name === "Tennessee" ? "#414141" : "#2c2c2c"} stroke="#727272" strokeWidth=".65" fillRule="evenodd" />;
      })}
      {start && end && !animate && <path d={routePath} fill="none" stroke="#e7bc5e" strokeWidth="1.8" />}
      {start && end && animate && <AnimatedFlight key={`${from?.code}-${to?.code}`} path={routePath} start={start} end={end} onComplete={onComplete} />}
      {[[start, from], [end, to]].map(([point, airport], i) => {
        const p = point as number[] | null, a = airport as Airport | null;
        return p && a ? <g key={i}><circle cx={p[0]} cy={p[1]} r="11" fill="#e7bc5e" fillOpacity=".15" /><circle cx={p[0]} cy={p[1]} r="4" fill={i ? "#e7bc5e" : "#fff"} /><text x={p[0]} y={p[1]+25} textAnchor="middle" fill="#fff" fontSize="12">{code(a.code)}</text></g> : null;
      })}
      <text x="20" y="272" fill="#bdbdbd" fontSize="9" letterSpacing="1.2">ILLUSTRATIVE ROUTE</text>
    </svg>
    <div className="search-route-bottom"><div><small>From</small><strong>{from?.city || "Your departure"}</strong></div><span aria-hidden="true">→</span><div><small>To</small><strong>{to?.city || "Your destination"}</strong></div></div>
  </section>;
}

export function LiveTripMap({
  positioningOrigin,
  pickup,
  destination,
  position,
  status,
  aircraftTransitionMs = 18000,
  snapAircraftToRoute = false,
}: {
  positioningOrigin: MapPoint | null;
  pickup: MapPoint;
  destination: MapPoint;
  position: {
    latitude: number;
    longitude: number;
    heading?: number | null;
    altitudeFeet?: number | null;
    groundSpeedKnots?: number | null;
    stale?: boolean;
  } | null;
  status: string;
  aircraftTransitionMs?: number;
  snapAircraftToRoute?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const grid = useId();
  const geoPoints = [
    positioningOrigin,
    pickup,
    destination,
    position
      ? {
          code: "",
          city: "",
          latitude: position.latitude,
          longitude: position.longitude,
        }
      : null,
  ].filter((point): point is MapPoint => Boolean(point));
  const west = Math.min(...geoPoints.map((point) => point.longitude)) - 2.5;
  const east = Math.max(...geoPoints.map((point) => point.longitude)) + 2.5;
  const south = Math.min(...geoPoints.map((point) => point.latitude)) - 1.5;
  const north = Math.max(...geoPoints.map((point) => point.latitude)) + 1.5;
  const factor = Math.cos(((north + south) / 2) * Math.PI / 180);
  const scale = Math.min(
    620 / Math.max(1, (east - west) * factor),
    220 / Math.max(1, north - south),
  );
  const project = ([longitude, latitude]: number[]) => [
    350 + (longitude - (west + east) / 2) * factor * scale,
    145 - (latitude - (north + south) / 2) * scale,
  ];
  const projected = (point: MapPoint) =>
    project([point.longitude, point.latitude]);
  const ring = (points: number[][]) =>
    points
      .map((point, index) => `${index ? "L" : "M"}${project(point).join(",")}`)
      .join(" ") + "Z";
  const curveGeometry = (from: MapPoint, to: MapPoint) => {
    const start = projected(from), end = projected(to);
    const dx = end[0] - start[0], dy = end[1] - start[1];
    const bend = Math.min(42, Math.hypot(dx, dy) * .16);
    const length = Math.max(1, Math.hypot(dx, dy));
    const control = [
      (start[0] + end[0]) / 2 + dy / length * bend,
      (start[1] + end[1]) / 2 - dx / length * bend,
    ];
    return { start, control, end };
  };
  const customerActive = ["customer_enroute", "arrived"].includes(status);
  const activeStart = customerActive ? pickup : positioningOrigin;
  const activeTarget = customerActive ? destination : pickup;
  const rawPlane = position && !["at_pickup", "ready_for_boarding", "arrived"].includes(status)
    ? project([position.longitude, position.latitude])
    : null;
  const snappedPlane = rawPlane && activeStart && snapAircraftToRoute
    ? (() => {
        const { start, control, end } = curveGeometry(activeStart, activeTarget);
        const dx = end[0] - start[0], dy = end[1] - start[1];
        const denominator = Math.max(1, dx * dx + dy * dy);
        const t = Math.max(0, Math.min(1, ((rawPlane[0] - start[0]) * dx + (rawPlane[1] - start[1]) * dy) / denominator));
        const inverse = 1 - t;
        return {
          point: [
            inverse * inverse * start[0] + 2 * inverse * t * control[0] + t * t * end[0],
            inverse * inverse * start[1] + 2 * inverse * t * control[1] + t * t * end[1],
          ],
          angle: Math.atan2(
            2 * inverse * (control[1] - start[1]) + 2 * t * (end[1] - control[1]),
            2 * inverse * (control[0] - start[0]) + 2 * t * (end[0] - control[0]),
          ) * 180 / Math.PI,
        };
      })()
    : null;
  const plane = snappedPlane?.point ?? rawPlane;
  const targetBearing = position && !snappedPlane
    ? (() => {
        const fromLatitude = position.latitude * Math.PI / 180;
        const toLatitude = activeTarget.latitude * Math.PI / 180;
        const longitudeDelta =
          (activeTarget.longitude - position.longitude) * Math.PI / 180;
        const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
        const x =
          Math.cos(fromLatitude) * Math.sin(toLatitude) -
          Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      })()
    : 90;
  const planeRotation = snappedPlane?.angle ?? targetBearing - 90;
  const viewWidth = 700 / zoom;
  const viewHeight = 290 / zoom;
  const focus = plane ?? [350, 145];
  const viewX = Math.max(0, Math.min(700 - viewWidth, focus[0] - viewWidth / 2));
  const viewY = Math.max(0, Math.min(290 - viewHeight, focus[1] - viewHeight / 2));
  const markerScale = 1 / zoom;
  const positioningCoordinates = positioningOrigin ? projected(positioningOrigin) : null;
  const pickupCoordinates = projected(pickup);
  const positioningPickupClose = Boolean(
    positioningCoordinates &&
    Math.hypot(
      positioningCoordinates[0] - pickupCoordinates[0],
      positioningCoordinates[1] - pickupCoordinates[1],
    ) < 65,
  );
  const code = (value: string) =>
    value.startsWith("K") && value.length === 4 ? value.slice(1) : value;
  return (
    <section className="search-route live-trip-map" aria-label="LiveTrip route map">
      <div className="search-route-top">
        <span>
          <i /> {position ? "Live aircraft position" : "Scheduled route preview"}
        </span>
        <span>{position ? "Updated automatically" : "Waiting for departure"}</span>
      </div>
      <div className="live-trip-map-controls" aria-label="Map zoom controls">
        <button type="button" onClick={() => setZoom((value) => Math.min(2.75, value + .5))} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => setZoom((value) => Math.max(1, value - .5))} aria-label="Zoom out">−</button>
        {zoom > 1 && <button type="button" className="reset" onClick={() => setZoom(1)}>Reset</button>}
      </div>
      {position && (
        <div className="live-trip-map-telemetry" aria-label="Live aircraft telemetry">
          <span>
            <small>Altitude</small>
            <strong>{position.altitudeFeet == null ? "—" : `${Math.round(position.altitudeFeet).toLocaleString()} ft`}</strong>
          </span>
          <span>
            <small>Ground speed</small>
            <strong>{position.groundSpeedKnots == null ? "—" : `${Math.round(position.groundSpeedKnots)} kt`}</strong>
          </span>
          {position.stale && <em>Last known</em>}
        </div>
      )}
      <svg viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Aircraft route and position">
        <defs>
          <pattern id={grid} width="35" height="35" patternUnits="userSpaceOnUse">
            <path d="M35 0H0V35" fill="none" stroke="white" strokeOpacity=".035" />
          </pattern>
        </defs>
        <rect width="700" height="290" fill={`url(#${grid})`} />
        {boundaries.map((feature) => {
          const polygons =
            feature.geometry.type === "Polygon"
              ? [feature.geometry.coordinates as number[][][]]
              : (feature.geometry.coordinates as number[][][][]);
          return (
            <path
              key={feature.name}
              d={polygons.map((polygon) => polygon.map(ring).join(" ")).join(" ")}
              fill={feature.name === "Tennessee" ? "#414141" : "#2c2c2c"}
              stroke="#727272"
              strokeWidth=".65"
              vectorEffect="non-scaling-stroke"
              fillRule="evenodd"
            />
          );
        })}
        {positioningOrigin && (
          <path
            d={(() => {
              const { start, control, end } = curveGeometry(positioningOrigin, pickup);
              return `M${start.join(",")} Q${control.join(",")} ${end.join(",")}`;
            })()}
            className="live-trip-leg positioning"
            data-active={!customerActive}
            pathLength="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={(() => {
            const { start, control, end } = curveGeometry(pickup, destination);
            return `M${start.join(",")} Q${control.join(",")} ${end.join(",")}`;
          })()}
          className="live-trip-leg customer"
          data-active={customerActive}
          pathLength="1"
          vectorEffect="non-scaling-stroke"
        />
        {[
          [positioningOrigin, "Positioning"],
          [pickup, "Pickup"],
          [destination, "Destination"],
        ].map(([point, label], index) => {
          if (!point) return null;
          const coordinates = projected(point as MapPoint);
          const labelY = positioningPickupClose && index === 0
            ? -16
            : positioningPickupClose && index === 1
              ? 31
              : 24;
          return (
            <g key={String(label)} transform={`translate(${coordinates[0]} ${coordinates[1]}) scale(${markerScale})`}>
              <circle r="10" fill="#e7bc5e" fillOpacity=".15" />
              <circle r="4" fill={index === 1 ? "#e7bc5e" : "#fff"} />
              <text y={labelY} textAnchor="middle" fill="#fff" stroke="#222" strokeWidth="3" paintOrder="stroke" fontSize="12" fontWeight="700">
                {code((point as MapPoint).code)}
              </text>
            </g>
          );
        })}
        {plane && (
          <g
            className="live-route-aircraft"
            style={{ transitionDuration: `${aircraftTransitionMs}ms` }}
            transform={`translate(${plane[0]} ${plane[1]}) rotate(${planeRotation}) scale(${markerScale})`}
          >
            <circle r="17" fill="#e7bc5e" fillOpacity=".18" />
            <path d="M10 0 2 -2 -3 -8 -5 -8 -2 -1 -8 -1 -10 -4 -11 -4 -10 0 -11 4 -10 4 -8 1 -2 1 -5 8 -3 8 2 2Z" fill="#fff" stroke="#222" strokeWidth=".5" />
          </g>
        )}
        <text x="20" y="272" fill="#bdbdbd" fontSize="9" letterSpacing="1.2">
          PHOENIX LIVETRIP
        </text>
      </svg>
      <div className="live-trip-map-legend">
        <span><i className="positioning" /> Positioning to pickup</span>
        <span><i className="customer" /> Your flight</span>
      </div>
    </section>
  );
}
