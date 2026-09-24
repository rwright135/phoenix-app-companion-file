"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LiveTripMap } from "./SearchRoute";
import "./live-trip.css";

type Airport = {
  code: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
};
type Leg = {
  kind: "positioning" | "customer";
  origin: Airport | null;
  destination: Airport;
  scheduledDeparture: string | null;
  scheduledArrival: string | null;
  available: boolean;
};
type LiveTripData = {
  status: string;
  demo: boolean;
  aircraft: { name: string; tailNumber: string | null };
  crewConfirmed: boolean;
  timezone: string;
  pickup: Airport;
  destination: Airport;
  positioningOrigin: Airport | null;
  fboInstructions: string;
  legs: Leg[];
  position: null | {
    latitude: number;
    longitude: number;
    altitudeFeet?: number | null;
    groundSpeedKnots: number | null;
    heading?: number | null;
    observedAt: string;
    stale: boolean;
  };
  distanceNm: number | null;
  minutesAway: number | null;
  updatedAt: string;
};

function standaloneDemoTrip(): LiveTripData {
  const now = Date.now();
  const positioningOrigin = {
    code: "KCKV",
    name: "Clarksville–Montgomery County Regional Airport",
    city: "Clarksville",
    latitude: 36.6218986511,
    longitude: -87.4150009155,
  };
  const pickup = {
    code: "KJWN",
    name: "John C Tune Airport",
    city: "Nashville",
    latitude: 36.1824,
    longitude: -86.886703,
  };
  const destination = {
    code: "KDTS",
    name: "Destin Executive Airport",
    city: "Destin",
    latitude: 30.400101,
    longitude: -86.471497,
  };
  return {
    status: "scheduled",
    demo: true,
    aircraft: { name: "Piper Malibu", tailNumber: "N92728" },
    crewConfirmed: true,
    timezone: "America/Chicago",
    pickup,
    destination,
    positioningOrigin,
    fboInstructions: "Meet your Phoenix crew in the FBO lobby. We’ll update this page when the aircraft is ready for boarding.",
    legs: [
      {
        kind: "positioning",
        origin: positioningOrigin,
        destination: pickup,
        scheduledDeparture: new Date(now + 30 * 60 * 1000).toISOString(),
        scheduledArrival: new Date(now + 75 * 60 * 1000).toISOString(),
        available: true,
      },
      {
        kind: "customer",
        origin: pickup,
        destination,
        scheduledDeparture: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        scheduledArrival: new Date(now + 4 * 60 * 60 * 1000).toISOString(),
        available: true,
      },
    ],
    position: null,
    distanceNm: null,
    minutesAway: null,
    updatedAt: new Date().toISOString(),
  };
}

function distanceNm(from: Airport, to: Airport) {
  const radians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 3440.065 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function previewFrame(base: LiveTripData, elapsed: number): LiveTripData {
  const seconds = Math.min(elapsed, 45);
  const status = seconds < 5
    ? "scheduled"
    : seconds < 16
      ? "positioning_enroute"
      : seconds < 21
        ? "at_pickup"
        : seconds < 25
          ? "ready_for_boarding"
          : seconds < 40
            ? "customer_enroute"
            : "arrived";
  const interpolate = (from: Airport, to: Airport, progress: number) => ({
    latitude: from.latitude + (to.latitude - from.latitude) * progress,
    longitude: from.longitude + (to.longitude - from.longitude) * progress,
  });
  let coordinates: { latitude: number; longitude: number } | null = null;
  let speed = 0;
  let altitude = 0;
  let target = base.pickup;
  if (status === "positioning_enroute" && base.positioningOrigin) {
    const progress = Math.max(0, Math.min(1, (seconds - 5) / 11));
    coordinates = interpolate(base.positioningOrigin, base.pickup, progress);
    speed = 218;
    altitude = progress > .12 && progress < .88 ? 9500 : 2800;
  } else if (["at_pickup", "ready_for_boarding"].includes(status)) {
    coordinates = base.pickup;
  } else if (status === "customer_enroute") {
    const progress = Math.max(0, Math.min(1, (seconds - 25) / 15));
    coordinates = interpolate(base.pickup, base.destination, progress);
    speed = 235;
    altitude = progress > .12 && progress < .88 ? 11500 : 3200;
    target = base.destination;
  } else if (status === "arrived") {
    coordinates = base.destination;
    target = base.destination;
  }
  const remaining = coordinates
    ? distanceNm({ ...target, ...coordinates }, target)
    : null;
  return {
    ...base,
    status,
    position: coordinates
      ? {
          ...coordinates,
          altitudeFeet: altitude,
          groundSpeedKnots: speed,
          heading: null,
          observedAt: new Date().toISOString(),
          stale: false,
        }
      : null,
    distanceNm: remaining == null ? null : Math.round(remaining),
    minutesAway: remaining != null && speed > 40
      ? Math.max(1, Math.round(remaining / speed * 60))
      : null,
    updatedAt: new Date().toISOString(),
  };
}

const statusCopy: Record<string, { eyebrow: string; title: string; body: string }> = {
  scheduled: {
    eyebrow: "Your aircraft is assigned",
    title: "Your day-of flight plan",
    body: "We’ll begin live tracking when your aircraft starts moving toward your pickup airport.",
  },
  positioning_enroute: {
    eyebrow: "Live · positioning flight",
    title: "Your aircraft is on the way",
    body: "Phoenix is tracking the aircraft inbound to your pickup airport.",
  },
  at_pickup: {
    eyebrow: "Aircraft at pickup",
    title: "Your aircraft has arrived",
    body: "Your crew is preparing the aircraft for your departure.",
  },
  ready_for_boarding: {
    eyebrow: "Ready for boarding",
    title: "Your aircraft is ready",
    body: "Follow the arrival instructions below when you’re ready to meet your crew.",
  },
  customer_enroute: {
    eyebrow: "Live · your flight",
    title: "You’re airborne",
    body: "Your Phoenix flight is now being tracked to your destination.",
  },
  arrived: {
    eyebrow: "Arrived",
    title: "Welcome to your destination",
    body: "Your Phoenix flight has arrived.",
  },
};

const stages = [
  ["scheduled", "Aircraft assigned"],
  ["positioning_enroute", "Positioning to pickup"],
  ["at_pickup", "Aircraft at pickup"],
  ["ready_for_boarding", "Ready for boarding"],
  ["customer_enroute", "En route"],
  ["arrived", "Arrived"],
] as const;

function displayCode(value: string) {
  return value.startsWith("K") && value.length === 4 ? value.slice(1) : value;
}

function formatTime(value: string | null, timezone: string) {
  if (!value) return "To be confirmed";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function timeUntil(value: string | null, offsetMinutes = 0) {
  if (!value) return "—";
  const minutes = Math.max(
    0,
    Math.ceil((Date.parse(value) - offsetMinutes * 60000 - Date.now()) / 60000),
  );
  if (minutes === 0) return "Now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function LiveTrip({
  token,
  previewInquiryId,
  standaloneDemo = false,
}: {
  token?: string;
  previewInquiryId?: string;
  standaloneDemo?: boolean;
}) {
  const [trip, setTrip] = useState<LiveTripData | null>(null);
  const [previewBase, setPreviewBase] = useState<LiveTripData | null>(null);
  const [previewElapsed, setPreviewElapsed] = useState(0);
  const [previewPaused, setPreviewPaused] = useState(false);
  const previewInitialized = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    let timer = 0;
    previewInitialized.current = false;
    setPreviewElapsed(0);
    setPreviewPaused(false);
    if (standaloneDemo) {
      previewInitialized.current = true;
      setPreviewBase(standaloneDemoTrip());
      return () => {
        current = false;
      };
    }
    const load = async () => {
      try {
        const response = await fetch(
          previewInquiryId
            ? `/api/v1/admin/inquiries/${previewInquiryId}/live-trip-preview`
            : `/api/v1/live-trips/${token}`,
          {
          cache: "no-store",
          },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error?.message ?? "Tracking is unavailable.");
        if (current) {
          if ((previewInquiryId || data.demo) && !previewInitialized.current) {
            previewInitialized.current = true;
            setPreviewBase(data);
          } else if (!previewInitialized.current) {
            setTrip(data);
          }
          setError("");
        }
      } catch (reason) {
        if (current) setError((reason as Error).message);
      }
    };
    void load().then(() => {
      if (current && !previewInitialized.current)
        timer = window.setInterval(load, 20000);
    });
    return () => {
      current = false;
      if (timer) window.clearInterval(timer);
    };
  }, [token, previewInquiryId, standaloneDemo]);

  useEffect(() => {
    if (!previewBase) return;
    setTrip(previewFrame(previewBase, previewElapsed));
  }, [previewBase, previewElapsed]);

  useEffect(() => {
    if (!previewBase || previewPaused || previewElapsed >= 45) return;
    const timer = window.setInterval(
      () => setPreviewElapsed((value) => value + .25),
      250,
    );
    return () => window.clearInterval(timer);
  }, [previewBase, previewPaused, previewElapsed]);

  if (!trip && !error)
    return (
      <main className="live-trip-shell live-trip-loading" aria-busy="true">
        <p>Loading your LiveTrip…</p>
      </main>
    );
  if (!trip)
    return (
      <main className="live-trip-shell">
        <section className="live-trip-unavailable">
          <p className="eyebrow">Phoenix Aviation</p>
          <h1>Tracking is unavailable</h1>
          <p>{error}</p>
        </section>
      </main>
    );

  const copy = statusCopy[trip.status] ?? statusCopy.scheduled;
  const activeIndex = stages.findIndex(([status]) => status === trip.status);
  const progress =
    stages.length > 1
      ? Math.max(0, activeIndex) / (stages.length - 1) * 100
      : 0;
  const positioning = trip.legs.find((leg) => leg.kind === "positioning")!;
  const customer = trip.legs.find((leg) => leg.kind === "customer")!;
  const targetLabel =
    trip.status === "customer_enroute" || trip.status === "arrived"
      ? "destination"
      : "pickup";
  const enroute = ["positioning_enroute", "customer_enroute"].includes(trip.status);
  const priorityCards = enroute
    ? [
        {
          label: `Distance to ${targetLabel}`,
          value: trip.distanceNm == null ? "—" : `${trip.distanceNm} nm`,
          detail: "Based on current aircraft position",
        },
        {
          label: `Time to ${targetLabel}`,
          value: trip.minutesAway == null ? "—" : `~${trip.minutesAway} min`,
          detail: "Live estimated flying time",
        },
      ]
    : trip.status === "at_pickup"
      ? [
          { label: "Aircraft status", value: "At pickup", detail: `${displayCode(trip.pickup.code)} · ${trip.pickup.name}` },
          {
            label: "Time until boarding",
            value: previewBase ? "24 min" : timeUntil(customer.scheduledDeparture, 20),
            detail: "Boarding begins 20 minutes before departure",
          },
        ]
      : trip.status === "ready_for_boarding"
        ? [
            { label: "Aircraft status", value: "Ready for boarding", detail: `${displayCode(trip.pickup.code)} · ${trip.pickup.name}` },
            {
              label: "Time until departure",
              value: previewBase ? "20 min" : timeUntil(customer.scheduledDeparture),
              detail: `Scheduled from ${displayCode(trip.pickup.code)}`,
            },
          ]
        : trip.status === "arrived"
          ? [
              { label: "Trip status", value: "Arrived", detail: `${displayCode(trip.destination.code)} · ${trip.destination.name}` },
            ]
          : [
              { label: "Aircraft status", value: "Assigned", detail: trip.aircraft.tailNumber || trip.aircraft.name },
              {
                label: "Time until positioning",
                value: previewBase ? "30 min" : timeUntil(positioning.scheduledDeparture),
                detail: `Positioning from ${displayCode(positioning.origin?.code ?? trip.positioningOrigin?.code ?? "TBD")}`,
              },
            ];
  return (
    <div className="live-trip-page">
      <header className="live-trip-header">
        <a href="https://flyphoenix.com" aria-label="Phoenix Aviation home">
          <Image
            src="/assets/phoenix_gold-1763274942834.png"
            width={46}
            height={50}
            alt=""
          />
          <span>PHOENIX AVIATION</span>
        </a>
        <span className="live-trip-secure">Private trip link</span>
      </header>
      <main className="live-trip-shell">
        {(previewInquiryId || trip.demo) ? (
          <div className="live-trip-preview-bar">
            <div>
              <strong>{previewInquiryId ? "Client preview" : "Demo tracking experience"}</strong>
              <span>45-second simulated LiveTrip · pause at any phase or replay from the beginning</span>
            </div>
            <div>
              <button type="button" onClick={() => setPreviewPaused((value) => !value)}>
                {previewPaused ? "Resume preview" : "Pause preview"}
              </button>
              <button type="button" onClick={() => { setPreviewElapsed(0); setPreviewPaused(false); }}>
                Replay
              </button>
            </div>
          </div>
        ) : null}
        <section className="live-trip-hero" data-status={trip.status}>
          <div>
            <h1>{copy.title}</h1>
            <div className="live-trip-phase-pill" role="status">
              <i aria-hidden="true" />
              <span>{copy.eyebrow}</span>
            </div>
          </div>
          <div className="live-trip-aircraft">
            <div className="live-trip-aircraft-lockup">
              <div className="live-trip-aircraft-identity">
                <span>{trip.aircraft.name}</span>
                <i aria-hidden="true">|</i>
                <span>{trip.aircraft.tailNumber || "Tail pending"}</span>
              </div>
              {trip.aircraft.name.toLowerCase().includes("malibu") && (
                <Image
                  src="/assets/fleet/malibu-transparent.png"
                  width={260}
                  height={116}
                  alt=""
                />
              )}
            </div>
          </div>
        </section>

        <section className="live-trip-progress" aria-label="Trip progress">
          <div
            className="live-trip-progress-track"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={stages.length}
            aria-valuenow={Math.max(1, activeIndex + 1)}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <ol>
            {stages.map(([status, label], index) => (
              <li
                key={status}
                className={index < activeIndex ? "complete" : index === activeIndex ? "active" : ""}
              >
                <span aria-hidden="true">{index < activeIndex ? "✓" : index + 1}</span>
                <strong>{label}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className={`live-trip-priority${priorityCards.length === 1 ? " single" : ""}`} aria-label="Current trip details">
          {priorityCards.map((card) => (
            <div key={card.label}>
              <small>{card.label}</small>
              <strong>{card.value}</strong>
              <span>{card.detail}</span>
            </div>
          ))}
        </section>

        <LiveTripMap
          positioningOrigin={trip.positioningOrigin}
          pickup={trip.pickup}
          destination={trip.destination}
          position={trip.position}
          status={trip.status}
          aircraftTransitionMs={previewBase ? 220 : 18000}
          snapAircraftToRoute={Boolean(previewBase)}
        />

        {trip.position?.stale && (
          <p className="live-trip-position-note" role="status">
            Position temporarily unavailable. Showing the aircraft’s last known position.
          </p>
        )}

        <section className="live-trip-legs">
          <FlightLeg
            title="Aircraft to your pickup"
            leg={positioning}
            timezone={trip.timezone}
            active={trip.status === "positioning_enroute"}
          />
          {customer.available ? (
            <FlightLeg
              title="Your Phoenix flight"
              leg={customer}
              timezone={trip.timezone}
              active={trip.status === "customer_enroute"}
            />
          ) : (
            <article className="live-trip-leg-card unavailable">
              <p className="eyebrow">Your flight</p>
              <h2>{displayCode(trip.pickup.code)} → {displayCode(trip.destination.code)}</h2>
              <p>Filed flight details will appear here as soon as they’re available.</p>
            </article>
          )}
        </section>

        {trip.fboInstructions && (
          <section className="live-trip-arrival">
            <p className="eyebrow">Pickup instructions</p>
            <h2>{trip.pickup.name}</h2>
            <p>{trip.fboInstructions}</p>
          </section>
        )}
        <p className="live-trip-disclaimer">
          Live position and time-to-airport are informational estimates based on ADS-B coverage. Phoenix operational updates control your trip status.
        </p>
      </main>
    </div>
  );
}

function FlightLeg({
  title,
  leg,
  timezone,
  active,
}: {
  title: string;
  leg: Leg;
  timezone: string;
  active: boolean;
}) {
  return (
    <article className={`live-trip-leg-card${active ? " active" : ""}`}>
      <p className="eyebrow">{active ? "Live now" : title}</p>
      <h2>
        {leg.origin ? displayCode(leg.origin.code) : "TBD"} → {displayCode(leg.destination.code)}
      </h2>
      <div>
        <span>
          <small>Departure</small>
          <strong>{formatTime(leg.scheduledDeparture, timezone)}</strong>
        </span>
        <span>
          <small>Arrival</small>
          <strong>{formatTime(leg.scheduledArrival, timezone)}</strong>
        </span>
      </div>
    </article>
  );
}
