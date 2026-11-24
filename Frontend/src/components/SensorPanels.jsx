// HMC5883L compass dial and MPU6050 level for the Control page.
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function CompassBlock({ t }) {
  const hdg = num(t.hdg);
  const gpsCourse = t.fix && num(t.spd) > 1.5 ? num(t.cog) : null;
  const status = !t.cmp ? "missing" : t.cal ? "calibrated" : "not calibrated";
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);

  return (
    <div className="sensor-block">
      <h4>Compass <small className={t.cmp && t.cal ? "" : "warn-text"}>{status}</small></h4>
      <div className="sensor-body">
        <svg viewBox="-60 -60 120 120" className="sensor-dial" aria-label="Compass">
          <circle r="56" className="dial-face" />
          {ticks.map((a) => (
            <line
              key={a}
              y1={-56}
              y2={a % 90 === 0 ? -47 : -52}
              transform={`rotate(${a})`}
              className="dial-tick"
            />
          ))}
          {[["N", 0], ["E", 90], ["S", 180], ["W", 270]].map(([l, a]) => (
            <text
              key={l}
              x={Math.sin((a * Math.PI) / 180) * 38}
              y={-Math.cos((a * Math.PI) / 180) * 38 + 4}
              className={`dial-letter ${l === "N" ? "north" : ""}`}
            >
              {l}
            </text>
          ))}
          {hdg !== null && (
            <g transform={`rotate(${hdg})`} className="dial-needle">
              <polygon points="0,-44 6,4 0,0 -6,4" className="needle-head" />
              <polygon points="0,0 6,4 0,18 -6,4" className="needle-tail" />
            </g>
          )}
          {gpsCourse !== null && (
            <line y1={-56} y2={-44} transform={`rotate(${gpsCourse})`} className="dial-gps" />
          )}
          <circle r="3" className="dial-hub" />
        </svg>
        <div className="sensor-values">
          <div><span>Heading</span><strong>{hdg !== null ? `${hdg.toFixed(0)}°` : "—"}</strong></div>
          <div><span>Direction</span><strong>{hdg !== null ? cardinal(hdg) : "—"}</strong></div>
          <div><span>Status</span><strong>{t.cmp ? (t.cal ? "OK" : "Calibrate") : "Missing"}</strong></div>
        </div>
      </div>
    </div>
  );
}

const cardinal = (deg) =>
  ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round((((deg % 360) + 360) % 360) / 45) % 8];

function LevelBlock({ t }) {
  const roll = num(t.roll);
  const pitch = num(t.pitch);
  const has = roll !== null && pitch !== null;
  const r = has ? roll : 0;
  const p = has ? Math.max(-30, Math.min(30, pitch)) : 0;
  const tilt = has ? Math.max(Math.abs(roll), Math.abs(pitch)) : 0;
  const level = !has ? "no data" : tilt < 5 ? "level" : tilt < 15 ? "tilted" : "STRONG TILT";

  return (
    <div className="sensor-block">
      <h4>Level <small className={has && tilt >= 15 ? "warn-text" : ""}>{has ? level : "no data"}</small></h4>
      <div className="sensor-body">
        <svg viewBox="-60 -60 120 120" className="sensor-dial" aria-label="Level">
          <defs>
            <clipPath id="horizon-clip"><circle r="56" /></clipPath>
          </defs>
          <g clipPath="url(#horizon-clip)">
            <g transform={`rotate(${-r}) translate(0 ${p * 1.5})`}>
              <rect x="-120" y="-120" width="240" height="120" className="sky" />
              <rect x="-120" y="0" width="240" height="120" className="water" />
              <line x1="-120" x2="120" className="horizon-line" />
              {[-20, -10, 10, 20].map((d) => (
                <line key={d} x1={-10} x2={10} y1={-d * 1.5} y2={-d * 1.5} className="pitch-mark" />
              ))}
            </g>
          </g>
          <circle r="56" className="dial-ring" />
          <path d="M -30 0 H -10 L -5 6 L 0 0 L 5 6 L 10 0 H 30" className="boat-mark" />
        </svg>
        <div className="sensor-values">
          <div><span>Roll</span><strong>{has ? `${roll.toFixed(0)}°` : "—"}</strong></div>
          <div><span>Pitch</span><strong>{has ? `${pitch.toFixed(0)}°` : "—"}</strong></div>
          <div><span>Tilt</span><strong className={tilt >= 15 ? "warn-text" : ""}>{has ? `${tilt.toFixed(0)}°` : "—"}</strong></div>
        </div>
      </div>
    </div>
  );
}

export function AttitudePanel({ t }) {
  return (
    <article className="panel sensor-panel">
      <div className="panel-heading">
        <div>
          <h2>Compass &amp; level</h2>
          <p>HMC5883L heading · MPU6050 roll / pitch</p>
        </div>
      </div>
      <div className="attitude-grid">
        <CompassBlock t={t} />
        <LevelBlock t={t} />
      </div>
    </article>
  );
}
