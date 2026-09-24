"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { SearchRoute } from "./SearchRoute";
import "./search-refined.css";
import { AircraftImage } from "./AircraftImage";
import { money } from "../domain/money";
import { dateToUtc, todayIn } from "../domain/time";
import { api } from "../api-client/index";
import type {
  Airport,
  AircraftOption,
  Attribution,
  SearchRequest,
} from "../validation/index";
import { trackGooglePage } from "./google-analytics";
import { Icon } from "./Icon";
import { Calendar, dayLabel } from "./Calendar";
export const airportCode = (code: string) =>
  code.length === 4 && code.startsWith("K") ? code.slice(1) : code;
export const requestPoint = (
  request: SearchRequest,
  side: "origin" | "destination",
) => {
  const location =
    side === "origin" ? request.originRequest : request.destinationRequest;
  return location
    ? `${location.city}, ${location.state}`
    : airportCode(request[side]);
};
function browserAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search);
  let visitorId = crypto.randomUUID();
  try {
    visitorId = localStorage.getItem("phoenix-visitor-id") ?? visitorId;
    localStorage.setItem("phoenix-visitor-id", visitorId);
  } catch {
    /* Tracking remains functional when storage is unavailable. */
  }
  let referrer = "";
  try {
    referrer = document.referrer ? new URL(document.referrer).origin : "";
  } catch {
    /* Ignore malformed referrers. */
  }
  let referringHost = "";
  try {
    referringHost = referrer ? new URL(referrer).hostname : "";
  } catch {
    /* Ignore malformed browser referrers. */
  }
  const gaCookie = document.cookie
    .split("; ")
    .find((value) => value.startsWith("_ga="))
    ?.slice(4, 124);
  const width = window.innerWidth;
  const current: Attribution = {
    visitorId,
    source: (params.get("utm_source") || referringHost || "direct").slice(
      0,
      120,
    ),
    medium: (
      params.get("utm_medium") || (referrer ? "referral" : "none")
    ).slice(0, 120),
    campaign: params.get("utm_campaign")?.slice(0, 200),
    term: params.get("utm_term")?.slice(0, 200),
    content: params.get("utm_content")?.slice(0, 200),
    landingPage: window.location.pathname.slice(0, 500),
    referrer: referrer || undefined,
    gclid: params.get("gclid")?.slice(0, 200),
    fbclid: params.get("fbclid")?.slice(0, 200),
    gaClientId: gaCookie,
    language: navigator.language.slice(0, 40),
    device: width < 600 ? "mobile" : width < 1024 ? "tablet" : "desktop",
  };
  try {
    const stored = localStorage.getItem("phoenix-first-touch");
    if (stored) return { ...current, ...JSON.parse(stored), visitorId };
    localStorage.setItem("phoenix-first-touch", JSON.stringify(current));
  } catch {
    /* Use this page's attribution when first-touch storage is unavailable. */
  }
  return current;
}
function AirportPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Airport | null;
  onChange: (v: Airport | null) => void;
}) {
  const [query, setQuery] = useState(""),
    [items, setItems] = useState<Airport[]>([]),
    [error, setError] = useState(""),
    [requestingLocation, setRequestingLocation] = useState(false),
    [resolvingLocation, setResolvingLocation] = useState(false),
    [city, setCity] = useState(""),
    [state, setState] = useState("");
  const generation = useRef(0),
    input = useRef<HTMLInputElement>(null);
  return (
    <div className="airport-picker">
      <div className="airport-anchor">
        <label>
          {label}
          <div className={"airport-control " + (value ? "chosen" : "")}>
            <Icon name={value ? "check" : "search"} />
            <input
              ref={input}
              aria-label={label}
              autoComplete="off"
              placeholder="Search by city, airport, or code"
              value={
                value
                  ? value.requested
                    ? `${value.city}, ${value.state} · Phoenix selects airport`
                    : `${airportCode(value.code)} – ${value.name}`
                  : query
              }
              onChange={async (e) => {
                const g = ++generation.current;
                const q = e.target.value;
                onChange(null);
                setQuery(q);
                if (!q.trim()) {
                  setItems([]);
                  return;
                }
                try {
                  const r = await api.airports(q);
                  if (g !== generation.current) return;
                  setItems(r.items);
                  setError(
                    r.items.length
                      ? ""
                      : "No airports found. Try a city or airport code.",
                  );
                } catch {
                  if (g === generation.current)
                    setError("Airport search unavailable. Please try again.");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  generation.current++;
                  setItems([]);
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  input.current
                    ?.closest(".airport-picker")
                    ?.querySelector<HTMLButtonElement>(".suggestions button")
                    ?.focus();
                }
              }}
            />
            {(value || query) && (
              <button
                type="button"
                className="clear-airport"
                aria-label={`Clear ${label.toLowerCase()}`}
                onClick={() => {
                  generation.current++;
                  onChange(null);
                  setQuery("");
                  setItems([]);
                  input.current?.focus();
                }}
              >
                <Icon name="close" />
              </button>
            )}
          </div>
        </label>

        {items.length > 0 && (
          <ul className="suggestions" aria-label={`${label} results`}>
            {items.map((a) => (
              <li key={a.code}>
                <button
                  type="button"
                  onClick={() => {
                    generation.current++;
                    onChange(a);
                    setQuery("");
                    setItems([]);
                    setError("");
                  }}
                >
                  <div>
                    <strong>{airportCode(a.code)}</strong>
                    <span>
                      {a.city}
                      {a.state ? `, ${a.state}` : ""}
                    </span>
                    <p>{a.name}</p>
                  </div>
                  <Icon name="chevron" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && !value && <small role="status">{error}</small>}
      {!value && !requestingLocation && (
        <button
          type="button"
          className="location-request-toggle"
          onClick={() => {
            setRequestingLocation(true);
            setItems([]);
            setError("");
          }}
        >
          Request by city and state
        </button>
      )}
      {!value && requestingLocation && (
        <div className="location-request-fields">
          <label>
            City
            <input
              value={city}
              maxLength={80}
              autoComplete="address-level2"
              onChange={(e) => setCity(e.target.value)}
            />
          </label>
          <label>
            State
            <input
              value={state}
              maxLength={2}
              placeholder="TN"
              autoComplete="address-level1"
              onChange={(e) =>
                setState(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
              }
            />
          </label>
          <button
            type="button"
            disabled={
              resolvingLocation || city.trim().length < 2 || state.length !== 2
            }
            onClick={async () => {
              const cleanCity = city.trim();
              setResolvingLocation(true);
              setError("");
              try {
                const result = await api.airportByCity(cleanCity, state);
                onChange({
                  ...result.airport,
                  city: result.requestedLocation.city,
                  state: result.requestedLocation.state,
                  requested: true,
                });
                setQuery("");
                setRequestingLocation(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setResolvingLocation(false);
              }
            }}
          >
            {resolvingLocation ? "Finding nearby airport…" : "Use city & state"}
          </button>
        </div>
      )}
    </div>
  );
}
export function Search({
  portalOrigin,
  onReserve,
  reserveLabel,
}: {
  portalOrigin: string;
  onReserve?: (request: SearchRequest, aircraftId: string) => Promise<void>;
  reserveLabel?: string;
}) {
  const [from, setFrom] = useState<Airport | null>(null),
    [to, setTo] = useState<Airport | null>(null);
  const [tripType, setType] = useState<"one-way" | "round-trip">("one-way");
  const [departure, setDeparture] = useState(""),
    [returnAt, setReturn] = useState("");
  const [passengers, setPassengers] = useState(1),
    [notes, setNotes] = useState("");
  const [options, setOptions] = useState<AircraftOption[]>([]),
    [saved, setSaved] = useState<SearchRequest | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [calendar, setCalendar] = useState<"departure" | "return" | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [autoSearch, setAutoSearch] = useState(false);
  const [arrival, setArrival] = useState<
    "checking" | "airports" | "options" | "ready"
  >("checking");
  const [incomingRoute, setIncomingRoute] = useState("");
  const [slowArrival, setSlowArrival] = useState(false);
  useEffect(() => {
    if (arrival === "ready") return;
    const timer = setTimeout(() => setSlowArrival(true), 10000);
    return () => clearTimeout(timer);
  }, [arrival]);
  const [searchRun, setSearchRun] = useState(0);
  const selectedRoute = from && to ? `${from.code}-${to.code}` : "";
  const [searchedRoute, setSearchedRoute] = useState("");
  const routeKey = `${selectedRoute}-${searchRun}`;
  const animateRoute = Boolean(
    selectedRoute && searchedRoute === selectedRoute && searchRun > 0,
  );
  const [finishedRoute, setFinishedRoute] = useState("");
  const finishRoute = useCallback(() => setFinishedRoute(routeKey), [routeKey]);
  const routeAnimating = Boolean(animateRoute && finishedRoute !== routeKey);
  const timezone = from?.timezone ?? "America/Chicago",
    generation = useRef(0),
    results = useRef<HTMLElement>(null);
  useEffect(() => {
    generation.current++;
    setOptions([]);
    setSaved(null);
    setSearchedRoute("");
    setBusy(false);
  }, [from, to, tripType, departure, returnAt, passengers, notes]);
  useEffect(() => {
    let cancelled = false;
    const today = todayIn("America/Chicago");
    const params = new URLSearchParams(window.location.search);
    const origin = params.get("origin")?.trim().toUpperCase();
    const destination = params.get("destination")?.trim().toUpperCase();
    const requestedDeparture = params.get("departure");
    const requestedReturn = params.get("returnAt");
    const requestedPassengers = Number(params.get("passengers"));
    const requestedType = params.get("tripType");
    const isDate = (value: string | null) =>
      Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= today);
    const exactAirport = (items: Airport[], code: string) =>
      items.find(
        (airport) =>
          airport.code.toUpperCase() === code ||
          airport.iata?.toUpperCase() === code ||
          airportCode(airport.code).toUpperCase() === code,
      ) ?? null;

    setDeparture(isDate(requestedDeparture) ? requestedDeparture! : today);
    setReturn(
      isDate(requestedReturn)
        ? requestedReturn!
        : isDate(requestedDeparture)
          ? requestedDeparture!
          : today,
    );
    setPassengers(
      Number.isInteger(requestedPassengers) &&
        requestedPassengers >= 1 &&
        requestedPassengers <= 20
        ? requestedPassengers
        : 1,
    );
    setType(
      requestedType === "round-trip" && isDate(requestedReturn)
        ? "round-trip"
        : "one-way",
    );

    if (origin && destination && isDate(requestedDeparture)) {
      setArrival("airports");
      setIncomingRoute(`${airportCode(origin)} → ${airportCode(destination)}`);
      Promise.all([api.airports(origin), api.airports(destination)])
        .then(([originResults, destinationResults]) => {
          if (cancelled) return;
          const selectedOrigin = exactAirport(originResults.items, origin);
          const selectedDestination = exactAirport(
            destinationResults.items,
            destination,
          );
          if (!selectedOrigin || !selectedDestination)
            throw new Error(
              "One of the selected airports is no longer available.",
            );
          setFrom(selectedOrigin);
          setTo(selectedDestination);
          setArrival("options");
          setAutoSearch(true);
        })
        .catch((e) => {
          if (cancelled) return;
          setError((e as Error).message);
          setArrival("ready");
        });
    } else {
      setArrival("ready");
      api
        .airports("KCKV")
        .then((r) => setFrom(r.items[0] ?? null))
        .catch(() => setError("Airport service unavailable"));
    }
    api.analytics("page_view", browserAttribution()).catch(() => {});
    void trackGooglePage();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!autoSearch || !from || !to || !departure) return;
    setAutoSearch(false);
    setSearchedRoute(`${from.code}-${to.code}`);
    setSearchRun((current) => current + 1);
    const g = ++generation.current;
    const request: SearchRequest = {
      origin: from.code,
      destination: to.code,
      departure: dateToUtc(departure, from.timezone),
      ...(tripType === "round-trip"
        ? { returnAt: dateToUtc(returnAt, from.timezone) }
        : {}),
      flexibleTime: true,
      tripType,
      passengers,
      timezone: from.timezone,
      notes: "",
    };
    setBusy(true);
    setError("");
    api
      .search(request)
      .then((response) => {
        if (g !== generation.current) return;
        setSaved(request);
        setOptions(response.items);
        api.analytics("search_completed", browserAttribution()).catch(() => {});
      })
      .catch((e) => {
        if (g === generation.current) setError((e as Error).message);
      })
      .finally(() => {
        if (g === generation.current) {
          setBusy(false);
          setArrival("ready");
        }
      });
  }, [autoSearch, departure, from, passengers, returnAt, to, tripType]);
  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearchRun((current) => current + 1);
    setSearchedRoute(selectedRoute);
    const g = ++generation.current;
    setError("");
    setBusy(true);
    setOptions([]);
    try {
      if (!from || !to)
        throw new Error("Select airports or request city and state");
      const body: SearchRequest = {
        origin: from.code,
        destination: to.code,
        ...(from.requested
          ? { originRequest: { city: from.city, state: from.state! } }
          : {}),
        ...(to.requested
          ? { destinationRequest: { city: to.city, state: to.state! } }
          : {}),
        departure: dateToUtc(departure, timezone),
        ...(tripType === "round-trip"
          ? { returnAt: dateToUtc(returnAt, timezone) }
          : {}),
        flexibleTime: true,
        tripType,
        passengers,
        timezone,
        notes,
      };
      const r = await (onReserve ? api.search(body) : api.catalogSearch(body));
      if (g !== generation.current) return;
      api.analytics("search_completed", browserAttribution()).catch(() => {});
      setSaved(body);
      setOptions(r.items);
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function reserve(id: string) {
    if (!saved) return;
    const g = generation.current;
    setBusy(true);
    setError("");
    try {
      if (onReserve) {
        await onReserve(saved, id);
        setBusy(false);
        return;
      }
      const { token } = await api.session(saved, id, browserAttribution());
      if (g !== generation.current) return;
      const signIn = new URL("/sign-in", portalOrigin);
      signIn.searchParams.set("returnTo", "/");
      signIn.hash = "token=" + encodeURIComponent(token);
      window.location.assign(signIn.toString());
    } catch (e) {
      if (g === generation.current) {
        setError((e as Error).message);
        setBusy(false);
      }
    }
  }
  if (arrival === "checking" || arrival === "airports")
    return (
      <section
        className="search-arrival"
        aria-busy="true"
        aria-label="Preparing your flight search"
      >
        <div className="search-arrival-path" aria-hidden="true">
          <span />
          <i />
          <span />
        </div>
        <p className="search-arrival-route">
          {incomingRoute || "Your Phoenix trip"}
        </p>
        <h1>Preparing your trip</h1>
        <p role="status">
          {slowArrival
            ? "This is taking a little longer. We’re still preparing your trip."
            : "We’re bringing your trip details with you. No need to enter them again."}
        </p>
        <div className="search-arrival-steps" aria-hidden="true">
          <span className="active">Your airports</span>
          <span>Flight options</span>
        </div>
      </section>
    );
  return (
    <div className="booking-layout refined-search search-arrived">
      <form className="panel booking-panel" onSubmit={search}>
        <h1>Plan your flight</h1>
        <label className="field-title">Trip type</label>
        <div className="toggle">
          <button
            type="button"
            aria-pressed={tripType === "one-way"}
            onClick={() => setType("one-way")}
          >
            One-way
          </button>
          <button
            type="button"
            aria-pressed={tripType === "round-trip"}
            onClick={() => {
              setType("round-trip");
              setReturn(departure);
            }}
          >
            Round-trip
          </button>
        </div>
        <div className="date-fields">
          <div>
            <label className="field-title" id="departure-label">
              Departure date
            </label>
            <button
              type="button"
              className="date-trigger"
              aria-labelledby="departure-label departure-value"
              onClick={() => setCalendar("departure")}
            >
              <Icon name="calendar" />
              <span id="departure-value">
                {departure
                  ? dayLabel(
                      departure,
                      departure.slice(0, 4) !== todayIn(timezone).slice(0, 4),
                    )
                  : "Select date"}
              </span>
            </button>
          </div>
          {tripType === "round-trip" && (
            <div>
              <label className="field-title" id="return-label">
                Return date
              </label>
              <button
                type="button"
                className="date-trigger"
                aria-labelledby="return-label return-value"
                onClick={() => setCalendar("return")}
              >
                <Icon name="calendar" />
                <span id="return-value">
                  {returnAt
                    ? dayLabel(
                        returnAt,
                        returnAt.slice(0, 4) !== departure.slice(0, 4),
                      )
                    : "Select date"}
                </span>
              </button>
            </div>
          )}
        </div>
        <AirportPicker
          label="Departure airport"
          value={from}
          onChange={setFrom}
        />
        <div className="swap-row">
          <button
            type="button"
            className="swap-button"
            aria-label="Swap airports"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
          >
            <Icon name="swap" />
          </button>
        </div>
        <AirportPicker label="Arrival airport" value={to} onChange={setTo} />
        <div className="trip-overview">
          <div className="passenger-quick">
            <Icon name="user" />
            <output aria-live="polite">
              {passengers} {passengers === 1 ? "passenger" : "passengers"}
            </output>
            <button
              type="button"
              aria-label="Remove passenger"
              disabled={passengers <= 1}
              onClick={() => setPassengers((count) => count - 1)}
            >
              <Icon name="minus" />
            </button>
            <button
              type="button"
              aria-label="Add passenger"
              disabled={passengers >= 20}
              onClick={() => setPassengers((count) => count + 1)}
            >
              <Icon name="plus" />
            </button>
          </div>
          <button
            type="button"
            className="trip-details-toggle"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            Trip details
          </button>
        </div>
        {detailsOpen && (
          <div className="trip-extra-fields">
            <label>
              Special requests, baggage or pets
              <textarea
                value={notes}
                maxLength={2000}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <p className="muted">
              Dates follow {timezone.replaceAll("_", " ")}. Departure time is
              flexible; our team will coordinate it with you.
            </p>
          </div>
        )}
        <button
          className="primary full-width"
          disabled={busy || !from || !to || !departure}
        >
          {busy ? "Finding your options…" : "See flight options"}
        </button>
      </form>
      {calendar && (
        <Calendar
          title={
            calendar === "departure"
              ? "Choose a departure date"
              : "Choose a return date"
          }
          value={calendar === "departure" ? departure : returnAt}
          min={calendar === "return" ? departure : todayIn(timezone)}
          onClose={() => setCalendar(null)}
          onSelect={(date) => {
            if (calendar === "departure") {
              setDeparture(date);
              if (returnAt < date) setReturn(date);
            } else setReturn(date);
          }}
        />
      )}
      <div className="search-results">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <SearchRoute
          key={routeKey}
          from={from}
          to={to}
          date={departure ? dayLabel(departure, true) : ""}
          roundTrip={tripType === "round-trip"}
          animate={animateRoute}
          onComplete={finishRoute}
        />
        {(routeAnimating || busy) && !error && (
          <div className="route-options-pending" role="status">
            <span className="route-options-shimmer" aria-hidden="true" />
            <span className="route-options-search-icon" aria-hidden="true">
              <Icon name="search" />
            </span>
            <p>
              {routeAnimating
                ? "Planning your route"
                : "Gathering your flight options"}
            </p>
            <small>Your aircraft options will appear here.</small>
          </div>
        )}
        {saved && !routeAnimating && (
          <section
            ref={results}
            aria-label="Aircraft estimates"
            className="results-section"
          >
            <div className="route-summary">
              <span>
                {saved.tripType === "one-way" ? "One-way" : "Round-trip"} ·{" "}
                {dayLabel(departure, true)}
                {saved.returnAt ? " – " + dayLabel(returnAt, true) : ""}
              </span>
              <h2>
                {requestPoint(saved, "origin")} <span>→</span>{" "}
                {requestPoint(saved, "destination")}
              </h2>
              <p>
                {saved.passengers} passenger{saved.passengers === 1 ? "" : "s"}{" "}
                · Departure time flexible
              </p>
              {(saved.originRequest || saved.destinationRequest) && (
                <p className="location-estimate-note">
                  Estimated using a nearby airport. Phoenix will confirm the
                  best airport for your trip before your booking is finalized.
                </p>
              )}
            </div>
            <div className="aircraft-list">
              {options.map((o) => (
                <article
                  className={`panel aircraft${o.catalogId ? " offering-card" : ""}`}
                  key={o.id}
                >
                  <AircraftImage
                    key={o.image}
                    image={
                      !o.catalogId && /malibu/i.test(o.name)
                        ? "/assets/fleet/malibu-studio.webp"
                        : o.image
                    }
                    name={o.name}
                  />
                  <div className="card-body">
                    <h2>
                      <Icon name="plane" />
                      {o.name}
                    </h2>
                    {o.models && <p className="offering-models">{o.models}</p>}
                    {o.relationship && (
                      <span className="offering-badge">{o.relationship}</span>
                    )}
                    <p className="offering-operator">
                      {o.operatorName
                        ? `Operated by ${o.operatorName}`
                        : "Aircraft and operator confirmed with your quote."}
                    </p>
                    <div className="aircraft-stats">
                      <div>
                        <span>Distance</span>
                        <strong>
                          {Math.round(o.distanceMiles).toLocaleString()} mi
                        </strong>
                      </div>
                      <div>
                        <span>Flight time</span>
                        <strong>
                          {Math.floor(Math.round(o.flightHours * 60) / 60)}h{" "}
                          {Math.round(o.flightHours * 60) % 60}m
                        </strong>
                      </div>
                    </div>
                    <p className="seat-count">
                      <Icon name="user" />
                      {o.seats} Seats
                    </p>
                    {Object.values(o.amenities).some(Boolean) && (
                      <div
                        className="aircraft-amenities-list"
                        aria-label="Aircraft amenities"
                      >
                        {o.amenities.lavatory && (
                          <span>
                            <Icon name="lavatory" />
                            Lavatory
                          </span>
                        )}
                        {o.amenities.wifi && (
                          <span>
                            <Icon name="wifi" />
                            Wi-Fi
                          </span>
                        )}
                        {o.amenities.largeBaggage && (
                          <span>
                            <Icon name="luggage" />
                            Large baggage
                          </span>
                        )}
                        {o.amenities.petCrate && (
                          <span>
                            <Icon name="pet" />
                            Pet crate
                          </span>
                        )}
                      </div>
                    )}
                    <div className="price-block">
                      <div className="total-estimate">
                        <span>
                          {o.priceMode === "quote"
                            ? "Whole aircraft"
                            : "Whole-trip estimate"}
                        </span>
                        <strong>
                          {o.priceMode === "quote"
                            ? "Request quote"
                            : money(o.indicativeCents)}
                          {o.priceMode === "range" && o.maximumCents
                            ? ` – ${money(o.maximumCents)}`
                            : ""}
                        </strong>
                      </div>
                    </div>
                    {o.availability === "unavailable" && (
                      <p className="availability-copy">
                        <Icon name="info" />
                        {o.reason}
                      </p>
                    )}
                    <button
                      className="primary full-width"
                      disabled={busy || o.availability === "unavailable"}
                      onClick={() => reserve(o.id)}
                    >
                      {o.availability === "unavailable"
                        ? "Unavailable"
                        : (reserveLabel ?? "Request quote")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {options.length === 0 && (
              <p>
                No aircraft found for this request. Please try another route.
              </p>
            )}
            <p className="estimate-note">
              <Icon name="info" />
              <span>
                You are requesting the whole aircraft. All displayed prices are
                estimates; final quotes and availability are confirmed after our
                team reviews your trip.
              </span>
            </p>
            <button
              className="secondary full-width search-reset"
              onClick={() => {
                generation.current++;
                setSaved(null);
                setOptions([]);
                setBusy(false);
                setFrom(null);
                setTo(null);
                setType("one-way");
                setDeparture(todayIn(timezone));
                setReturn("");
                setPassengers(1);
                setNotes("");
                setError("");
                setDetailsOpen(false);
                setSearchedRoute("");
              }}
            >
              Reset Search
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
