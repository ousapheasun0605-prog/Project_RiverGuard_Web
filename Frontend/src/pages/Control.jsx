import { useCallback, useEffect, useState } from "react";
import {
  Compass,
  Crosshair,
  Home,
  Navigation,
  OctagonX,
  Play,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";

import BoatMap from "../components/BoatMap";
import DPad from "../components/DPad";
import { AttitudePanel } from "../components/SensorPanels";
import LinkPanel from "../components/LinkPanel";
import CameraPanel from "../components/CameraPanel";
import { ActivityLog, ConnectionBadge } from "../components/LivePanels";
import { useBoat } from "../lib/boat";

function Stat({ label, value, warn }) {
  return (
    <div className={`telemetry-stat ${warn ? "warn" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const fmt = (v, d = 0, unit = "") =>
  typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(d)}${unit}` : "—";

// LTE signal from RSRP (dBm): > -80 excellent, > -90 good, > -100 fair, else poor.
const signalLabel = (t) => {
  if (t.net !== "LTE" || typeof t.rsrp !== "number" || t.rsrp === 0) return "—";
  if (t.rsrp > -80) return "Excellent";
  if (t.rsrp > -90) return "Good";
  if (t.rsrp > -100) return "Fair";
  return "Poor";
};

export default function Control() {
  const { send, telemetry, trail, clearTrail, connected, online, lastError, clearError } = useBoat();
  const t = telemetry || {};
  const [pending, setPending] = useState(null);
  const [follow, setFollow] = useState(true);
  const [power, setPower] = useState(60);
  const [speed, setSpeed] = useState(30);
  const [waitMin, setWaitMin] = useState(5);
  const [notice, setNotice] = useState(null);

  const flash = (text) => {
    setNotice(text);
    setTimeout(() => setNotice((n) => (n === text ? null : n)), 4000);
  };

  const cmd = useCallback(
    (command, args, label) => {
      if (!send(command, args)) {
        flash("Not connected to the server");
        return;
      }
      if (label) flash(`Sent: ${label}`);
    },
    [send]
  );

  const drive = useCallback((l, r) => send("drive", { l, r }), [send]);
  const release = useCallback(() => send("stop"), [send]);

  // Escape = emergency stop.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") cmd("stop", {}, "STOP");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cmd]);

  const sendTarget = () => {
    if (!pending) return;
    cmd("target", { lat: pending[0], lon: pending[1] }, "Target B");
    setPending(null);
  };

  const lowBattery = t.ina && typeof t.batP === "number" && t.batP < 25;

  return (
    <div className="control-page">
      <div className="page-heading">
        <div>
          <h1>Remote control</h1>
          <p>Drive the boat, set home and target, and start trips over 4G</p>
        </div>
        <ConnectionBadge />
      </div>

      {!online && (
        <div className="control-warning">
          {connected
            ? "No telemetry from the boat. Commands are still sent, but you can't see if it obeys."
            : "Not connected to the RiverGuard server. Reconnecting..."}
        </div>
      )}
      {notice && <div className="control-notice">{notice}</div>}
      {lastError && (
        <div className="control-warning" onClick={clearError} role="button" tabIndex={0}>
          Error: {lastError} (click to close)
        </div>
      )}

      <section className="control-grid">
        <article className="panel control-map-panel">
          <div className="panel-heading">
            <div>
              <h2>Map</h2>
              <p>Click the map to pick a new target B, then press "Send B"</p>
            </div>
            <label className="follow-toggle">
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
              Follow boat
            </label>
          </div>
          <div className="map-frame control-map-frame">
            <BoatMap
              telemetry={t}
              trail={trail}
              pendingTarget={pending}
              onMapClick={setPending}
              follow={follow}
            />
          </div>
          <div className="map-footer">
            <span>
              {pending
                ? `New B: ${pending[0].toFixed(6)}, ${pending[1].toFixed(6)}`
                : t.tgt
                  ? `B on boat: ${fmt(t.tlat, 6)}, ${fmt(t.tlon, 6)}`
                  : "No target B yet"}
            </span>
            <span className="map-coordinate">
              GPS: {t.fix ? `${fmt(t.lat, 6)}, ${fmt(t.lon, 6)}` : "no fix"}
            </span>
            <button type="button" className="small-button secondary" onClick={clearTrail}>
              <Trash2 size={14} /> Clear trail
            </button>
          </div>
        </article>

        <aside className="control-side">
          <div className="side-col">
          <button type="button" className="estop-button" onClick={() => cmd("stop", {}, "STOP")}>
            <OctagonX size={26} />
            STOP
            <small>Esc key</small>
          </button>

          <CameraPanel className="camera-compact" />
          <AttitudePanel t={t} />
          </div>

          <div className="side-col">

          <article className="panel control-card">
            <h3>Manual drive <small>hold a button or W A S D</small></h3>
            <DPad onDrive={drive} onRelease={release} disabled={!connected} power={power} />
            <label className="range-row">
              <span>Power</span>
              <input type="range" min={10} max={100} step={5} value={power} onChange={(e) => setPower(Number(e.target.value))} />
              <strong>{power}%</strong>
            </label>
          </article>

          <article className="panel control-card gps-card">
            <h3>GPS trip A → B → A</h3>
            <div className="gps-buttons">
              <button type="button" className="small-button secondary" onClick={() => cmd("home", {}, "Set home A here")} title="Set home A at the boat's position">
                <Home size={13} /> Set A
              </button>
              <button type="button" className="small-button secondary" disabled={!pending} onClick={sendTarget} title="Click the map first, then send B">
                <Crosshair size={13} /> Send B
              </button>
              <button type="button" className="small-button primary" onClick={() => cmd("go", {}, "Go to B")} title="Start the trip">
                <Play size={13} /> Go
              </button>
              <button type="button" className="small-button secondary" onClick={() => cmd("rth", {}, "Return home")} title="Return home">
                <Undo2 size={13} /> Return
              </button>
            </div>
            <div className="gps-inputs">
              <label title="Auto speed %">
                Speed
                <input type="number" min={10} max={100} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />%
              </label>
              <button type="button" className="small-button secondary" onClick={() => cmd("speed", { value: speed }, `Speed ${speed}%`)}>Set</button>
              <label title="Wait at B (minutes)">
                Wait
                <input type="number" min={0} max={30} value={waitMin} onChange={(e) => setWaitMin(Number(e.target.value))} />min
              </label>
              <button type="button" className="small-button secondary" onClick={() => cmd("wait", { value: waitMin }, `Wait ${waitMin} min`)}>Set</button>
            </div>
            <div className="gps-buttons two">
              <button type="button" className="small-button secondary" onClick={() => cmd("calh", {}, "Calibrate by hand")} title="Turn the boat 2-3 full circles in 20 s">
                <Compass size={13} /> Cal. hand
              </button>
              <button type="button" className="small-button secondary" onClick={() => cmd("cals", {}, "Calibrate by spinning")} title="Boat spins in place (props in water)">
                <RotateCcw size={13} /> Cal. spin
              </button>
            </div>
          </article>

          <LinkPanel telemetry={telemetry} />
          </div>
        </aside>
      </section>

      <section className="control-bottom">

      <section className="panel telemetry-panel">
        <div className="panel-heading">
          <div>
            <h2>Telemetry</h2>
            <p>{t.msg ? `Boat says: ${t.msg}` : "Waiting for the boat"}</p>
          </div>
          <span className="panel-tag">
            <Navigation size={13} /> {t.mode || "—"}
          </span>
        </div>
        <div className="telemetry-grid">
          <Stat label="Mode" value={t.mode || "—"} />
          <Stat label="Action" value={t.act || "—"} />
          <Stat label="GPS" value={t.fix ? `fix · ${t.sats} sats` : `no fix · ${t.sats ?? 0} sats`} warn={!t.fix} />
          <Stat label="HDOP" value={fmt(t.hdop, 1)} />
          <Stat label="Speed" value={fmt(t.spd, 1, " km/h")} />
          <Stat label="Heading" value={fmt(t.hdg, 0, "°")} />
          <Stat label="Compass" value={t.cmp ? (t.cal ? "OK, calibrated" : "not calibrated") : "missing"} warn={!t.cal} />
          <Stat label="Battery" value={t.ina ? `${fmt(t.v, 2, " V")} · ${t.batP}%` : "no INA219"} warn={lowBattery} />
          <Stat label="Current" value={t.ina ? fmt(t.a, 2, " A") : "—"} />
          <Stat label="4G" value={t.lte ? `${t.lte} · CSQ ${t.csq}` : "—"} />
          <Stat label="Network" value={t.net ? [t.net, t.band, t.oper].filter(Boolean).join(" · ") : "—"} />
          <Stat label="RSRP / SINR" value={t.net === "LTE" ? `${fmt(t.rsrp)} dBm / ${fmt(t.sinr)} dB` : "—"} />
          <Stat label="Signal" value={signalLabel(t)} warn={t.net === "LTE" && t.rsrp < -100} />
          <Stat label="To goal" value={t.dist >= 0 ? fmt(t.dist, 0, " m") : "—"} />
          <Stat label="Motors L / R" value={t.l != null ? `${t.l} / ${t.r}` : "—"} />
          <Stat label="Auto speed" value={t.speed != null ? `${t.speed}%` : "—"} />
          <Stat label="Wait left" value={t.wait ? `${t.wait} s` : "—"} />
          <Stat label="Roll / pitch" value={t.roll != null ? `${fmt(t.roll)}° / ${fmt(t.pitch)}°` : "—"} />
          <Stat label="Uptime" value={t.up != null ? `${Math.floor(t.up / 60)} min` : "—"} />
        </div>
      </section>
      </section>

      <ActivityLog />
    </div>
  );
}
