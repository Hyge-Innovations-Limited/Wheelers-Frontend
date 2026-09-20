"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DispatchRide, DriverPresence, LiveDriver, TrailPoint } from "@/lib/admin-api";

/**
 * The map itself. Leaflet is imperative and owns its DOM, so React only hands
 * it data: markers are updated in place (moved, re-styled) rather than torn
 * down and rebuilt on every poll, which is what keeps a 10-second refresh from
 * flickering or resetting the operator's zoom.
 *
 * Loaded with next/dynamic { ssr: false } — Leaflet touches `window` on import.
 */

const NIGERIA_CENTRE: L.LatLngTuple = [9.082, 8.6753];
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export interface MapFocus {
  lat: number;
  lng: number;
  /** Changes whenever the operator asks again, so the same spot can be re-centred. */
  key: number;
}

interface Props {
  drivers: LiveDriver[];
  rides: DispatchRide[];
  selectedDriverId: string | null;
  selectedRideId: string | null;
  trail: TrailPoint[];
  focus: MapFocus | null;
  onSelectDriver: (id: string) => void;
  onSelectRide: (id: string) => void;
}

function driverIcon(presence: DriverPresence, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span class="lm-pin lm-pin--${presence}${selected ? " is-selected" : ""}"><span class="lm-pin-core"></span></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function rideIcon(selected: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span class="lm-ride${selected ? " is-selected" : ""}">R</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export default function LiveMapCanvas({
  drivers,
  rides,
  selectedDriverId,
  selectedRideId,
  trail,
  focus,
  onSelectDriver,
  onSelectRide,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverLayerRef = useRef<L.LayerGroup | null>(null);
  const rideLayerRef = useRef<L.LayerGroup | null>(null);
  const trailLayerRef = useRef<L.LayerGroup | null>(null);
  const driverMarkersRef = useRef(new Map<string, { marker: L.Marker; look: string }>());
  const fittedRef = useRef(false);

  // Handlers change identity every render; markers must call the latest one.
  const selectDriverRef = useRef(onSelectDriver);
  const selectRideRef = useRef(onSelectRide);
  useEffect(() => {
    selectDriverRef.current = onSelectDriver;
    selectRideRef.current = onSelectRide;
  }, [onSelectDriver, onSelectRide]);

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    const markers = driverMarkersRef.current;

    const map = L.map(hostRef.current, { zoomControl: false, attributionControl: true }).setView(NIGERIA_CENTRE, 6);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);

    trailLayerRef.current = L.layerGroup().addTo(map);
    rideLayerRef.current = L.layerGroup().addTo(map);
    driverLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // The panel beside the map opens and closes; Leaflet needs telling.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(hostRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markers.clear();
      fittedRef.current = false;
    };
  }, []);

  // Drivers: move what exists, add what is new, drop what is gone.
  useEffect(() => {
    const layer = driverLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;

    const markers = driverMarkersRef.current;
    const seen = new Set<string>();

    for (const driver of drivers) {
      seen.add(driver.id);
      const selected = driver.id === selectedDriverId;
      const look = `${driver.presence}:${selected}`;
      const label = `<strong>${escapeHtml(driver.name)}</strong>${driver.plate ? ` · ${escapeHtml(driver.plate)}` : ""}`;
      const existing = markers.get(driver.id);

      if (existing) {
        existing.marker.setLatLng([driver.lat, driver.lng]);
        existing.marker.setTooltipContent(label);
        if (existing.look !== look) {
          existing.marker.setIcon(driverIcon(driver.presence, selected));
          existing.look = look;
        }
        existing.marker.setZIndexOffset(selected ? 1000 : driver.presence === "offline" ? -100 : 0);
        continue;
      }

      const marker = L.marker([driver.lat, driver.lng], {
        icon: driverIcon(driver.presence, selected),
        keyboard: false,
        zIndexOffset: selected ? 1000 : driver.presence === "offline" ? -100 : 0,
      })
        .bindTooltip(label, { direction: "top", offset: [0, -12], className: "lm-tooltip" })
        .on("click", () => selectDriverRef.current(driver.id));
      marker.addTo(layer);
      markers.set(driver.id, { marker, look });
    }

    for (const [id, entry] of markers) {
      if (seen.has(id)) continue;
      layer.removeLayer(entry.marker);
      markers.delete(id);
    }

    // Open on where the drivers actually are, once. After that the operator owns the view.
    if (!fittedRef.current && drivers.length > 0) {
      const live = drivers.filter((driver) => driver.presence !== "offline");
      const target = live.length > 0 ? live : drivers;
      map.fitBounds(L.latLngBounds(target.map((driver) => [driver.lat, driver.lng] as L.LatLngTuple)), {
        padding: [60, 60],
        maxZoom: 13,
      });
      fittedRef.current = true;
    }
  }, [drivers, selectedDriverId]);

  // Waiting rides: few and short-lived, so a rebuild is simpler than a diff.
  useEffect(() => {
    const layer = rideLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const ride of rides) {
      L.marker([ride.pickupLat, ride.pickupLng], {
        icon: rideIcon(ride.id === selectedRideId),
        keyboard: false,
        zIndexOffset: 500,
      })
        .bindTooltip(`<strong>Waiting rider</strong> · ${escapeHtml(ride.pickupAddress)}`, {
          direction: "top",
          offset: [0, -14],
          className: "lm-tooltip",
        })
        .on("click", () => selectRideRef.current(ride.id))
        .addTo(layer);
    }
  }, [rides, selectedRideId]);

  useEffect(() => {
    const layer = trailLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (trail.length < 2) return;
    const path = trail.map((point) => [point.lat, point.lng] as L.LatLngTuple);
    L.polyline(path, { color: "#0D0D0D", weight: 6, opacity: 0.9, lineCap: "round", lineJoin: "round" }).addTo(layer);
    L.polyline(path, { color: "#FF5C00", weight: 3, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(layer);
    L.circleMarker(path[0], { radius: 5, color: "#0D0D0D", weight: 2, fillColor: "#FFFFFF", fillOpacity: 1 })
      .bindTooltip("Trail starts here", { className: "lm-tooltip" })
      .addTo(layer);
  }, [trail]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    // Deliberately keyed on focus.key alone: a poll that nudges the coordinates
    // must not yank the view back while the operator is panning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  return <div ref={hostRef} className="lm-canvas" aria-label="Live driver map" />;
}
