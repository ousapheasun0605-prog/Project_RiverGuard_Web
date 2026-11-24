import MissionRouteMap from "../components/MissionRouteMap";
import { useEffect, useState } from "react";
import api, { errorText } from "../lib/api";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Route,
  Recycle,
  Search,
  Waves,
} from "lucide-react";

const STATUS_LABEL = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  STOPPED: "Stopped",
  FAILED: "Failed",
};

const toRad = (d) => (d * Math.PI) / 180;
const haversine = (a, b) => {
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const routeOf = (telemetry = []) =>
  telemetry.filter((p) => p.latitude != null && p.longitude != null).map((p) => [p.latitude, p.longitude]);

const distanceKm = (route) => {
  let m = 0;
  for (let i = 1; i < route.length; i += 1) {
    const step = haversine(route[i - 1], route[i]);
    if (step < 200) m += step;
  }
  return m / 1000;
};

const fmtDuration = (from, to) => {
  if (!from) return "—";
  const s = Math.max(0, Math.round(((to ? new Date(to) : new Date()) - new Date(from)) / 1000));
  const min = Math.floor(s / 60);
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min ${s % 60} s`;
};

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";

const COMMAND_LABEL = {
  START_MISSION: "Start mission",
  STOP_MISSION: "Stop mission",
  RETURN_HOME: "Return home",
  EMERGENCY_STOP: "Emergency stop",
};

function StatusBadge({ status }) {
  return (
    <span className={`mission-status ${status.toLowerCase()}`}>
      <span className="status-dot" />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function MissionCard({ mission, expanded, onToggle }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!expanded) return;
    api
      .get(`/missions/${mission.id}`)
      .then((res) => setDetail(res.data.mission))
      .catch((e) => setError(errorText(e)));
  }, [expanded, mission.id]);

  const route = routeOf(detail?.telemetry);
  const commands = detail?.commands || [];

  return (
    <article className={`mission-card ${expanded ? "expanded" : ""}`}>
      <button
        type="button"
        className="mission-card-summary"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`details-${mission.id}`}
      >
        <div className="mission-id-block">
          <span className="mission-id">{mission.missionCode}</span>
          <span className="mission-date">{fmtDate(mission.startedAt || mission.createdAt)}</span>
        </div>

        <div className="mission-robot">
          <span className="mission-field-label">Robot</span>
          <span>{mission.robot?.name || "—"}</span>
        </div>

        <div className="mission-waste">
          <span className="mission-field-label">Started by</span>
          <strong>{mission.initiatedBy?.name || "—"}</strong>
        </div>

        <StatusBadge status={mission.status} />

        <span className="mission-expand-icon">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      {expanded && (
        <div className="mission-card-details" id={`details-${mission.id}`}>
          <div className="mission-detail-stats">
            <div className="mission-detail-stat">
              <Clock3 size={16} />
              <div>
                <span>Duration</span>
                <strong>{fmtDuration(mission.startedAt, mission.endedAt)}</strong>
              </div>
            </div>

            <div className="mission-detail-stat">
              <Route size={16} />
              <div>
                <span>Distance traveled</span>
                <strong>{detail ? `${distanceKm(route).toFixed(2)} km` : "…"}</strong>
              </div>
            </div>

            <div className="mission-detail-stat">
              <Recycle size={16} />
              <div>
                <span>GPS points</span>
                <strong>{detail ? route.length : "…"}</strong>
              </div>
            </div>
          </div>

          <div className="mission-detail-grid">
            <section className="mission-route-section">
              <div className="mission-section-heading">
                <h3>Mission route</h3>
                <span>{route.length > 1 ? "Recorded GPS track" : "No GPS track"}</span>
              </div>

              <MissionRouteMap positions={route} />

              {error && <p className="mission-description">{error}</p>}
            </section>

            <section className="mission-commands-section">
              <div className="mission-section-heading">
                <h3>Command history</h3>
                <span>{commands.length} entries</span>
              </div>

              <div className="mission-command-list">
                {commands.length === 0 && <p className="mission-description">No commands recorded.</p>}
                {commands.map((item) => (
                  <div className="mission-command-item" key={item.id}>
                    <span className="mission-command-time">
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </span>
                    <div className="mission-command-info">
                      <strong>{COMMAND_LABEL[item.type] || item.type}</strong>
                      <span>{item.lastError || (item.payload?.lines ? item.payload.lines.join(" · ") : item.payload?.text || "")}</span>
                    </div>
                    <span className={`command-result ${item.status.toLowerCase()}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </article>
  );
}

export default function Missions() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [expandedMission, setExpandedMission] = useState(null);

  useEffect(() => {
    api
      .get("/missions")
      .then((res) => setMissions(res.data.missions))
      .catch((e) => setLoadError(errorText(e)))
      .finally(() => setLoading(false));
  }, []);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredMissions = missions.filter((mission) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      mission.missionCode.toLowerCase().includes(q) ||
      mission.name.toLowerCase().includes(q) ||
      (mission.robot?.name || "").toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "All" || mission.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="missions-page">
      <header className="page-heading missions-page-heading">
        <div>
          <h1>Missions</h1>
          <p>Review mission history, routes, and cleanup results.</p>
        </div>

        <span className="demo-data-label">
          <span className="status-dot online" />
          Live database
        </span>
      </header>

      <section className="missions-overview">
        <div className="missions-overview-icon">
          <Waves size={19} />
        </div>
        <div>
          <strong>Mission history</strong>
          <p>Expand a mission to inspect its details and activity.</p>
        </div>
        <span className="missions-count">
          {filteredMissions.length} missions
        </span>
      </section>

      <section className="missions-toolbar">
        <label className="mission-search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search mission ID or robot..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search missions"
          />
        </label>

        <select
          className="mission-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter missions by status"
        >
          <option value="All">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </section>

      <div className="mission-list-heading">
        <h2>All missions</h2>
        <span>Most recent first</span>
      </div>

      <section className="mission-list">
        {loading ? (
          <div className="missions-empty-state"><strong>Loading missions…</strong></div>
        ) : loadError ? (
          <div className="missions-empty-state"><strong>{loadError}</strong></div>
        ) : filteredMissions.length > 0 ? (
          filteredMissions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              expanded={expandedMission === mission.id}
              onToggle={() =>
                setExpandedMission((current) =>
                  current === mission.id ? null : mission.id
                )
              }
            />
          ))
        ) : (
          <div className="missions-empty-state">
            <Search size={22} />
            <strong>{missions.length ? "No matching missions" : "No missions yet"}</strong>
            <p>{missions.length ? "Try another mission ID, robot, or status." : "Start one from the Dashboard."}</p>
          </div>
        )}
      </section>

    </div>
  );
}
