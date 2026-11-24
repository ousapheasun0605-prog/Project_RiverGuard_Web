import { useEffect, useRef, useState } from "react";
import { Signal } from "lucide-react";

// 4G link: signal from the A7670G (AT+CSQ / AT+CPSI?) and the data the
// website really receives from the boat over the last 30 s.
// The module can't run a speed test, so "Data in" is measured traffic, not max speed.
const WINDOW_MS = 30000;

const quality = (t) => {
  if (t.net === "LTE" && typeof t.rsrp === "number" && t.rsrp !== 0) {
    if (t.rsrp > -80) return [4, "Excellent"];
    if (t.rsrp > -90) return [3, "Good"];
    if (t.rsrp > -100) return [2, "Fair"];
    return [1, "Poor"];
  }
  if (typeof t.csq === "number" && t.csq > 0 && t.csq < 99) {
    if (t.csq >= 20) return [4, "Excellent"];
    if (t.csq >= 15) return [3, "Good"];
    if (t.csq >= 10) return [2, "Fair"];
    return [1, "Poor"];
  }
  return [0, "No signal"];
};

const fmt = (v, d = 0, unit = "") =>
  typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(d)}${unit}` : "—";

export default function LinkPanel({ telemetry }) {
  const samples = useRef([]);
  const [stats, setStats] = useState({ rate: 0, every: null, age: null });

  useEffect(() => {
    if (!telemetry) return;
    const now = Date.now();
    samples.current.push({ at: now, bytes: JSON.stringify(telemetry).length });
  }, [telemetry]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const list = samples.current.filter((x) => now - x.at < WINDOW_MS);
      samples.current = list;
      const bytes = list.reduce((sum, x) => sum + x.bytes, 0);
      const span = list.length > 1 ? list[list.length - 1].at - list[0].at : 0;
      setStats({
        rate: bytes / (WINDOW_MS / 1000),
        every: list.length > 1 ? span / (list.length - 1) / 1000 : null,
        age: list.length ? (now - list[list.length - 1].at) / 1000 : null,
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const t = telemetry || {};
  const [bars, label] = quality(t);

  return (
    <article className="panel control-card link-panel">
      <h3>
        <Signal size={13} /> 4G link
        <span className={`signal-bars q${bars}`} title={label}>
          {[1, 2, 3, 4].map((b) => <i key={b} className={b <= bars ? "on" : ""} />)}
        </span>
        <small>{label}</small>
      </h3>
      <div className="link-grid">
        <div><span>Data in</span><strong>{stats.rate >= 1024 ? `${(stats.rate / 1024).toFixed(2)} KB/s` : `${stats.rate.toFixed(0)} B/s`}</strong></div>
        <div><span>Update every</span><strong>{stats.every ? `${stats.every.toFixed(1)} s` : "—"}</strong></div>
        <div><span>Last update</span><strong className={stats.age > 10 ? "warn-text" : ""}>{stats.age != null ? `${stats.age.toFixed(0)} s ago` : "—"}</strong></div>
        <div><span>Network</span><strong>{t.net ? [t.net, t.band].filter(Boolean).join(" ") : t.lte || "—"}</strong></div>
        <div><span>RSRP / SINR</span><strong>{t.net === "LTE" ? `${fmt(t.rsrp)} dBm / ${fmt(t.sinr)} dB` : "—"}</strong></div>
        <div><span>CSQ</span><strong>{t.csq != null && t.csq >= 0 ? `${t.csq} / 31` : "—"}</strong></div>
      </div>
    </article>
  );
}
