import { useState } from "react";
import {
  Activity,
  Battery,
  Clock3,
  Gauge,
  MapPin,
  Plus,
  Radio,
  Route,
  ShieldCheck,
  Square,
  Waves,
} from "lucide-react";

import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const initialPosition = [11.5564, 104.9282];

const commands = [
  {
    time: "--:--:--",
    command: "Awaiting robot connection",
    source: "System",
    result: "Unavailable",
  },
];

const robotIcon = L.divIcon({
  className: "robot-map-icon",
  html: '<div class="robot-map-marker"><span></span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function PlanningMap({ planning, areaPoints, setAreaPoints }) {
  useMapEvents({
    click(event) {
      if (!planning) return;

      setAreaPoints((current) => [
        ...current,
        [event.latlng.lat, event.latlng.lng],
      ]);
    },
  });

  return (
    <>
      {areaPoints.length > 0 && (
        <Polyline positions={areaPoints} color="#2f76a8" weight={3} />
      )}

      {areaPoints.length >= 3 && (
        <PolygonPlaceholder positions={areaPoints} />
      )}
    </>
  );
}

function PolygonPlaceholder({ positions }) {
  return (
    <Polyline
      positions={[...positions, positions[0]]}
      pathOptions={{ color: "#2f76a8", dashArray: "6 6", weight: 2 }}
    />
  );
}

function StatusCard({ icon: Icon, label, value, detail }) {
  return (
    <article className="status-card">
      <div className="status-card-heading">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <div className="status-card-value">{value}</div>
      <div className="status-card-detail">{detail}</div>
    </article>
  );
}

export default function Dashboard() {
  const [planning, setPlanning] = useState(false);
  const [areaPoints, setAreaPoints] = useState([]);
  const [missionActive, setMissionActive] = useState(false);

  function beginPlanning() {
    setAreaPoints([]);
    setPlanning(true);
  }

  function cancelPlanning() {
    setPlanning(false);
    setAreaPoints([]);
  }

  function confirmArea() {
    if (areaPoints.length < 3) return;

    // Planning is local-only until the backend and robot are connected.
    setPlanning(false);
    window.alert(
      "Mission area selected. Connect the backend to save and start the mission."
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Live river cleanup operations</p>
        </div>

        <div className="connection-status">
          <span className="status-dot offline" />
          <span>Robot connection unavailable</span>
        </div>
      </div>

      <section className="dashboard-top-grid">
        <article className="panel map-panel">
          <div className="panel-heading">
            <div>
              <h2>Live location</h2>
              <p>Robot position and mission route</p>
            </div>
            <span className="panel-tag">
              <MapPin size={13} />
              GPS map
            </span>
          </div>

          {planning && (
            <div className="planning-banner">
              <div>
                <strong>Map planning mode</strong>
                <p>Click the map to mark at least three boundary points.</p>
              </div>
              <button
                className="small-button secondary"
                onClick={cancelPlanning}
              >
                Cancel
              </button>
            </div>
          )}

          <div className="map-frame">
            <MapContainer
              center={initialPosition}
              zoom={16}
              scrollWheelZoom
              className="leaflet-map"
            >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

              <Circle
                center={initialPosition}
                radius={12}
                pathOptions={{
                  color: "#64849b",
                  fillColor: "#c8dceb",
                  fillOpacity: 0.35,
                }}
              />

              <Marker position={initialPosition} icon={robotIcon} />

              <PlanningMap
                planning={planning}
                areaPoints={areaPoints}
                setAreaPoints={setAreaPoints}
              />
            </MapContainer>
          </div>

          <div className="map-footer">
            <span>
              <span className="legend-dot robot" />
              Robot position
            </span>
            <span>
              <span className="legend-line" />
              Planned boundary
            </span>
            <span className="map-coordinate">GPS: unavailable</span>
          </div>

          {planning && (
            <div className="planning-actions">
              <span>{areaPoints.length} boundary points selected</span>
              <button
                className="small-button primary"
                disabled={areaPoints.length < 3}
                onClick={confirmArea}
              >
                Confirm area
              </button>
            </div>
          )}
        </article>

        <section className="status-stack" aria-label="Robot status">
          <StatusCard
            icon={Radio}
            label="Robot status"
            value="Offline"
            detail="Waiting for robot telemetry"
          />
          <StatusCard
            icon={Waves}
            label="Debris collected"
            value="— kg"
            detail="No mission data available"
          />
          <StatusCard
            icon={Gauge}
            label="Robot speed"
            value="— m/s"
            detail="Live speed unavailable"
          />
          <StatusCard
            icon={MapPin}
            label="GPS coordinates"
            value="—"
            detail="Waiting for GPS telemetry"
          />
          <StatusCard
            icon={Clock3}
            label="Mission duration"
            value="—"
            detail="No active mission"
          />
        </section>
      </section>

      <section className="panel active-mission-panel">
        <div className="mission-panel-heading">
          <div>
            <span className="section-eyebrow">MISSION CONTROL</span>
            <h2>Active mission</h2>
          </div>
          <span className="mission-state">
            <span className="status-dot offline" />
            No active mission
          </span>
        </div>

        <div className="mission-progress-row">
          <div className="mission-summary">
            <strong>Awaiting mission</strong>
            <span>Start a mission to begin cleanup operations.</span>
          </div>

          <div className="progress-area">
            <div className="progress-label">
              <span>Mission progress</span>
              <strong>—</strong>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: "0%" }} />
            </div>
          </div>

          {!missionActive ? (
            <button
              className="mission-action-button"
              onClick={beginPlanning}
              disabled={planning}
            >
              <Plus size={16} />
              New mission
            </button>
          ) : (
            <button
              className="mission-action-button stop"
              onClick={() => setMissionActive(false)}
            >
              <Square size={15} />
              Stop mission
            </button>
          )}
        </div>
      </section>

      <section className="panel command-panel">
        <div className="panel-heading command-panel-heading">
          <div>
            <h2>Command activity</h2>
            <p>Recent commands and robot responses</p>
          </div>
          <button className="small-button secondary" disabled>
            View all activity
          </button>
        </div>

        <div className="table-scroll">
          <table className="command-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Command / Activity</th>
                <th>Initiated by</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {commands.map((command) => (
                <tr key={command.command}>
                  <td>{command.time}</td>
                  <td>
                    <span className="command-name">
                      <Activity size={15} />
                      {command.command}
                    </span>
                  </td>
                  <td>{command.source}</td>
                  <td>
                    <span className="result-unavailable">
                      <ShieldCheck size={14} />
                      {command.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}