import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const defaultPosition = [11.5564, 104.9282];

function ResizeMap() {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

export default function MissionRouteMap({ positions = [] }) {
  const hasRoute = positions.length > 1;
  const center = positions.length > 0 ? positions[0] : defaultPosition;

  return (
    <div className="mission-route-map">
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={false}
        className="mission-route-leaflet"
      >
        <ResizeMap />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {hasRoute && (
          <>
            <Polyline
              positions={positions}
              pathOptions={{
                color: "#2f76a8",
                weight: 4,
              }}
            />

            <CircleMarker
              center={positions[0]}
              radius={6}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: "#2f76a8",
                fillOpacity: 1,
              }}
            />

            <CircleMarker
              center={positions[positions.length - 1]}
              radius={6}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: "#39866b",
                fillOpacity: 1,
              }}
            />
          </>
        )}
      </MapContainer>

      {!hasRoute && (
        <div className="mission-route-map-overlay">
          <strong>Route data unavailable</strong>
          <span>
            The map is a location preview until actual mission GPS data is connected.
          </span>
        </div>
      )}
    </div>
  );
}