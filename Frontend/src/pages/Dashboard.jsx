import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Battery,
  Clock3,
  Gamepad2,
  Gauge,
  MapPin,
  Plus,
  Radio,
  Square,
  Undo2,
  X,
} from "lucide-react";

import BoatMap from "../components/BoatMap";
import CameraPanel from "../components/CameraPanel";
import { ActivityLog, ConnectionBadge } from "../components/LivePanels";
import api, { errorText } from "../lib/api";
import { useBoat } from "../lib/boat";

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

const duration = (from, to) => {
  if (!from) return "—";
  const s = Math.max(0, Math.round(((to ? new Date(to) : new Date()) - new Date(from)) / 1000));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min ${s % 60} s`;
};

export default function Dashboard() {
  const { telemetry, trail, online, secondsAgo, missionEvent } = useBoat();
  const t = telemetry || {};

  const [missions, setMissions] = useState([]);
  const [planning, setPlanning] = useState(false);
  const [target, setTarget] = useState(null);
  const [waitMin, setWaitMin] = useState(5);
  const [speed, setSpeed] = useState(30);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const loadMissions = useCallback(async () => {
    try {
      const res = await api.get("/missions");
      setMissions(res.data.missions);
    } catch (error) {
      setMessage(errorText(error));
    }
  }, []);

  useEffect(() => {
    api
      .get("/missions")
      .then((res) => setMissions(res.data.missions))
      .catch((error) => setMessage(errorText(error)));
  }, [missionEvent]);

  // Poll while a start/stop is waiting for the boat.
  useEffect(() => {
    const id = setInterval(loadMissions, 5000);
    return () => clearInterval(id);
  }, [loadMissions]);

  const active = missions.find((m) => m.status === "ACTIVE");
  const planned = missions.find((m) => m.status === "PLANNED");
  const current = active || planned;

  const startPlanning = () => {
    setTarget(null);
    setPlanning(true);
    setMessage(null);
  };

  const startMission = async () => {
    if (!target) return;
    setBusy(true);
    setMessage(null);
    try {
      let mission = planned;
      if (!mission) {
        const created = await api.post("/missions");
        mission = created.data.mission;
      }
      const res = await api.post(`/missions/${mission.id}/start`, {
        target: { lat: target[0], lon: target[1] },
        waitMin,
        speed,
      });
      setMessage(res.data.message);
      setPlanning(false);
      setTarget(null);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
      loadMissions();
    }
  };

  const stopMission = async (returnHome) => {
    if (!current) return;
    setBusy(true);
    try {
      const res = await api.post(`/missions/${current.id}/stop`, { returnHome });
      setMessage(res.data.message);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
      loadMissions();
    }
  };

  const tripProgress = (() => {
    if (!active) return null;
    if (t.mode === "GO_TO_B") return 33;
    if (t.mode === "WAIT_AT_B") return 50;
    if (t.mode === "RETURN_HOME") return 75;
    if (t.mode === "HOLD") return 100;
    return 10;
  })();

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Live river cleanup operations</p>
        </div>
        <ConnectionBadge />
      </div>

      <section className="dashboard-top-grid">
        <article className="panel map-panel">
          <div className="panel-heading">
            <div>
              <h2>Live location</h2>
              <p>Boat position, home A and target B</p>
            </div>
            <Link to="/control" className="panel-tag link-tag">
              <Gamepad2 size={13} />
              Remote control
            </Link>
          </div>

          {planning && (
            <div className="planning-banner">
              <div>
                <strong>New mission</strong>
                <p>Click the map to pick target B. The boat goes there, waits, and returns to home A.</p>
              </div>
              <button className="small-button secondary" onClick={() => setPlanning(false)}>
                <X size={14} /> Cancel
              </button>
            </div>
          )}

          <div className="map-frame">
            <BoatMap
              telemetry={t}
              trail={trail}
              pendingTarget={planning ? target : null}
              onMapClick={planning ? setTarget : undefined}
            />
          </div>

          <div className="map-footer">
            <span>
              <span className="legend-dot robot" />
              Boat
            </span>
            <span>
              <span className="legend-line" />
              Trail
            </span>
            <span className="map-coordinate">
              GPS: {t.fix ? `${t.lat.toFixed(6)}, ${t.lon.toFixed(6)}` : "no fix"}
            </span>
          </div>

          {planning && (
            <div className="planning-actions">
              <label>
                Wait at B (min)
                <input type="number" min={0} max={30} value={waitMin} onChange={(e) => setWaitMin(Number(e.target.value))} />
              </label>
              <label>
                Speed %
                <input type="number" min={10} max={100} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
              </label>
              <span>{target ? `B: ${target[0].toFixed(5)}, ${target[1].toFixed(5)}` : "No point picked"}</span>
              <button className="small-button primary" disabled={!target || busy} onClick={startMission}>
                Start mission
              </button>
            </div>
          )}
        </article>

        <section className="status-stack" aria-label="Robot status">
          <StatusCard
            icon={Radio}
            label="Robot status"
            value={online ? t.mode || "Online" : "Offline"}
            detail={online ? `${t.lte || "link"} · updated ${secondsAgo}s ago` : "Waiting for robot telemetry"}
          />
          <StatusCard
            icon={Battery}
            label="Battery"
            value={t.ina ? `${t.v?.toFixed(2)} V` : "—"}
            detail={t.ina ? `${t.batP}% · ${t.a?.toFixed(2)} A` : "No battery sensor data"}
          />
          <StatusCard
            icon={Gauge}
            label="Robot speed"
            value={typeof t.spd === "number" ? `${(t.spd / 3.6).toFixed(2)} m/s` : "— m/s"}
            detail={typeof t.hdg === "number" ? `Heading ${t.hdg}°` : "Live speed unavailable"}
          />
          <StatusCard
            icon={MapPin}
            label="GPS coordinates"
            value={t.fix ? `${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}` : "—"}
            detail={t.fix ? `${t.sats} satellites · HDOP ${t.hdop}` : "Waiting for GPS fix"}
          />
          <StatusCard
            icon={Clock3}
            label="Mission duration"
            value={active ? duration(active.startedAt) : "—"}
            detail={active ? active.missionCode : "No active mission"}
          />
        </section>
      </section>

      <section className="panel active-mission-panel">
        <div className="mission-panel-heading">
          <div>
            <span className="section-eyebrow">MISSION CONTROL</span>
            <h2>{active ? "Active mission" : planned ? "Starting mission" : "No active mission"}</h2>
          </div>
          <span className="mission-state">
            <span className={`status-dot ${active ? "online" : planned ? "waiting" : "offline"}`} />
            {active ? `${active.missionCode} · ${t.mode || ""}` : planned ? `${planned.missionCode} · waiting for boat` : "Idle"}
          </span>
        </div>

        {message && <div className="control-notice inline">{message}</div>}

        <div className="mission-progress-row">
          <div className="mission-summary">
            <strong>{current ? current.name : "Awaiting mission"}</strong>
            <span>
              {active
                ? t.msg || "Trip in progress"
                : planned
                  ? "Start sent, waiting for the boat to begin the trip"
                  : "Plan a mission: pick B on the map, then start."}
            </span>
          </div>

          <div className="progress-area">
            <div className="progress-label">
              <span>Trip progress</span>
              <strong>{tripProgress != null ? `${tripProgress}%` : "—"}</strong>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${tripProgress ?? 0}%` }} />
            </div>
          </div>

          {current ? (
            <div className="mission-buttons">
              {active && (
                <button className="mission-action-button" disabled={busy} onClick={() => stopMission(true)}>
                  <Undo2 size={15} />
                  Return home
                </button>
              )}
              <button className="mission-action-button stop" disabled={busy} onClick={() => stopMission(false)}>
                <Square size={15} />
                {active ? "Stop mission" : "Cancel"}
              </button>
            </div>
          ) : (
            <button className="mission-action-button" onClick={startPlanning} disabled={planning}>
              <Plus size={16} />
              New mission
            </button>
          )}
        </div>
      </section>

      <CameraPanel />

      <ActivityLog title="Command activity" limit={10} />
    </div>
  );
}
