import { useEffect, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [11.5564, 104.9282];

const boatIcon = (heading = 0) =>
  L.divIcon({
    className: "boat-icon",
    html: `<div class="boat-arrow" style="transform: rotate(${Math.round(heading)}deg)"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 2 L19 21 L12 17 L5 21 Z" fill="#2f76a8" stroke="#fff" stroke-width="1.6"/></svg></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

const pinIcon = (label, color) =>
  L.divIcon({
    className: "pin-icon",
    html: `<div class="map-pin" style="background:${color}">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const HOME_ICON = pinIcon("A", "#39866b");
const TARGET_ICON = pinIcon("B", "#d9822b");

function ClickHandler({ onClick }) {
  useMapEvents({
    click(event) {
      onClick?.([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}

// Pan to the boat the first time we get a GPS fix, and when "follow" is on.
function FollowBoat({ position, follow }) {
  const map = useMap();
  const centered = useRef(false);
  useEffect(() => {
    if (!position) return;
    if (!centered.current || follow) {
      map.setView(position, centered.current ? map.getZoom() : 17, { animate: true });
      centered.current = true;
    }
  }, [map, position, follow]);
  return null;
}

function ResizeFix() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function BoatMap({
  telemetry,
  trail = [],
  pendingTarget = null,
  onMapClick,
  follow = false,
  className = "leaflet-map",
}) {
  const t = telemetry || {};
  const hasFix = t.fix && Number.isFinite(t.lat) && Number.isFinite(t.lon) && (t.lat !== 0 || t.lon !== 0);
  const position = hasFix ? [t.lat, t.lon] : null;
  const home = t.home && t.hlat ? [t.hlat, t.hlon] : null;
  const target = t.tgt && t.tlat ? [t.tlat, t.tlon] : null;

  return (
    <MapContainer center={position || DEFAULT_CENTER} zoom={16} scrollWheelZoom className={className}>
      <ResizeFix />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onMapClick} />
      <FollowBoat position={position} follow={follow} />

      {trail.length > 1 && (
        <Polyline positions={trail} pathOptions={{ color: "#2f76a8", weight: 3, opacity: 0.7 }} />
      )}

      {home && (
        <Marker position={home} icon={HOME_ICON}>
          <Tooltip>Home A</Tooltip>
        </Marker>
      )}

      {target && (
        <Marker position={target} icon={TARGET_ICON}>
          <Tooltip>Target B (on boat)</Tooltip>
        </Marker>
      )}

      {position && target && ["GO_TO_B"].includes(t.mode) && (
        <Polyline positions={[position, target]} pathOptions={{ color: "#d9822b", dashArray: "6 6", weight: 2 }} />
      )}
      {position && home && ["RETURN_HOME"].includes(t.mode) && (
        <Polyline positions={[position, home]} pathOptions={{ color: "#39866b", dashArray: "6 6", weight: 2 }} />
      )}

      {pendingTarget && (
        <CircleMarker
          center={pendingTarget}
          radius={9}
          pathOptions={{ color: "#d9822b", fillColor: "#f6c08a", fillOpacity: 0.8, dashArray: "3 3" }}
        >
          <Tooltip permanent direction="top">New B (not sent)</Tooltip>
        </CircleMarker>
      )}

      {position && <Marker position={position} icon={boatIcon(t.hdg || 0)} />}
    </MapContainer>
  );
}
