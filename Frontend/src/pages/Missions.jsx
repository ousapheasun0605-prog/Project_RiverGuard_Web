import MissionRouteMap from "../components/MissionRouteMap";
import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  MapPin,
  Route,
  Recycle,
  Search,
  Waves,
} from "lucide-react";

const demoMissions = [
  {
    id: "RGM-024",
    robot: "RG-01",
    status: "Completed",
    date: "Demo · Oct 24, 2026",
    duration: "32 min",
    distance: "1.8 km",
    waste: "2.3 kg",
    progress: 100,
    description: "Cleanup mission completed.",
    commands: [
      { time: "09:12:04", command: "Return to docking station", result: "Demo" },
      { time: "09:08:32", command: "Collection cycle completed", result: "Demo" },
      { time: "09:00:15", command: "Mission started", result: "Demo" },
    ],
  },
  {
    id: "RGM-023",
    robot: "RG-01",
    status: "Completed",
    date: "Demo · Oct 23, 2026",
    duration: "27 min",
    distance: "1.4 km",
    waste: "1.7 kg",
    progress: 100,
    description: "Cleanup mission completed.",
    commands: [
      { time: "14:27:10", command: "Return to docking station", result: "Demo" },
      { time: "14:14:20", command: "Collection cycle completed", result: "Demo" },
      { time: "14:00:00", command: "Mission started", result: "Demo" },
    ],
  },
  {
    id: "RGM-022",
    robot: "RG-01",
    status: "Stopped",
    date: "Demo · Oct 22, 2026",
    duration: "12 min",
    distance: "0.6 km",
    waste: "0.8 kg",
    progress: 42,
    description: "Mission stopped in this illustrative example.",
    commands: [
      { time: "10:12:45", command: "Mission stopped", result: "Demo" },
      { time: "10:00:00", command: "Mission started", result: "Demo" },
    ],
  },
];

function StatusBadge({ status }) {
  const statusClass = status.toLowerCase();

  return (
    <span className={`mission-status ${statusClass}`}>
      <span className="status-dot" />
      {status}
    </span>
  );
}

function MissionCard({ mission, expanded, onToggle }) {
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
          <span className="mission-id">{mission.id}</span>
          <span className="mission-date">{mission.date}</span>
        </div>

        <div className="mission-robot">
          <span className="mission-field-label">Robot</span>
          <span>{mission.robot}</span>
        </div>

        <div className="mission-waste">
          <span className="mission-field-label">Waste collected</span>
          <strong>{mission.waste}</strong>
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
                <strong>{mission.duration}</strong>
              </div>
            </div>

            <div className="mission-detail-stat">
              <Route size={16} />
              <div>
                <span>Distance traveled</span>
                <strong>{mission.distance}</strong>
              </div>
            </div>

            <div className="mission-detail-stat">
              <Recycle size={16} />
              <div>
                <span>Waste collected</span>
                <strong>{mission.waste}</strong>
              </div>
            </div>
          </div>

          <div className="mission-detail-grid">
            <section className="mission-route-section">
              <div className="mission-section-heading">
                <h3>Mission route</h3>
                <span>Illustrative preview</span>
              </div>

              <MissionRouteMap positions={mission.route ?? []} />

              <p className="mission-description">{mission.description}</p>
            </section>

            <section className="mission-commands-section">
              <div className="mission-section-heading">
                <h3>Command history</h3>
                <span>{mission.commands.length} demo entries</span>
              </div>

              <div className="mission-command-list">
                {mission.commands.map((item, index) => (
                  <div className="mission-command-item" key={`${item.time}-${index}`}>
                    <span className="mission-command-time">{item.time}</span>
                    <div className="mission-command-info">
                      <strong>{item.command}</strong>
                      <span>Illustrative entry</span>
                    </div>
                    <span className="demo-result">{item.result}</span>
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
  const [expandedMission, setExpandedMission] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredMissions = demoMissions.filter((mission) => {
    const matchesSearch =
      mission.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mission.robot.toLowerCase().includes(searchTerm.toLowerCase());

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
          <span className="status-dot" />
          Illustrative data
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
          <option value="Completed">Completed</option>
          <option value="Stopped">Stopped</option>
        </select>
      </section>

      <div className="mission-list-heading">
        <h2>All missions</h2>
        <span>Most recent first</span>
      </div>

      <section className="mission-list">
        {filteredMissions.length > 0 ? (
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
            <strong>No matching missions</strong>
            <p>Try another mission ID, robot, or status.</p>
          </div>
        )}
      </section>

      <p className="missions-disclaimer">
        Demo records are for interface testing only. Actual mission data will
        come from the RiverGuard database.
      </p>
    </div>
  );
}
