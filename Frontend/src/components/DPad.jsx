import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";

// Up / down / left / right buttons + keyboard (W A S D / arrow keys).
// Hold a button or key to drive. Two keys together (W + D) give a curve.
// Calls onDrive(l, r) about 4 times a second while held, onRelease() when let go.
// Firmware stops the motors by itself if no drive command arrives for 1 s.
const SEND_MS = 250;
const TURN = 0.7;

const KEY_MAP = {
  ArrowUp: "f", KeyW: "f",
  ArrowDown: "b", KeyS: "b",
  ArrowLeft: "l", KeyA: "l",
  ArrowRight: "r", KeyD: "r",
};

const toLR = (dirs, power) => {
  const y = (dirs.has("f") ? 1 : 0) - (dirs.has("b") ? 1 : 0);
  const x = (dirs.has("r") ? TURN : 0) - (dirs.has("l") ? TURN : 0);
  const l = Math.max(-1, Math.min(1, y + x));
  const r = Math.max(-1, Math.min(1, y - x));
  return [Math.round(l * power), Math.round(r * power)];
};

export default function DPad({ onDrive, onRelease, disabled, power = 100 }) {
  const keyDirs = useRef(new Set());
  const btnDir = useRef(null);
  const [active, setActive] = useState(() => new Set());
  const [lr, setLr] = useState([0, 0]);

  const current = useCallback(() => {
    const dirs = new Set(keyDirs.current);
    if (btnDir.current) dirs.add(btnDir.current);
    return dirs;
  }, []);

  const update = useCallback(() => {
    const dirs = current();
    setActive(dirs);
    if (!dirs.size) {
      setLr([0, 0]);
      onRelease?.();
      return;
    }
    const [l, r] = toLR(dirs, power);
    setLr([l, r]);
    onDrive?.(l, r);
  }, [current, onDrive, onRelease, power]);

  // Repeat while held.
  useEffect(() => {
    const id = setInterval(() => {
      const dirs = current();
      if (!dirs.size || disabled) return;
      const [l, r] = toLR(dirs, power);
      setLr([l, r]);
      onDrive?.(l, r);
    }, SEND_MS);
    return () => clearInterval(id);
  }, [current, onDrive, disabled, power]);

  // Keyboard.
  useEffect(() => {
    const isTyping = (e) => ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
    const down = (e) => {
      const d = KEY_MAP[e.code];
      if (disabled || !d || isTyping(e)) return;
      e.preventDefault();
      if (keyDirs.current.has(d)) return; // key repeat
      keyDirs.current.add(d);
      update();
    };
    const up = (e) => {
      const d = KEY_MAP[e.code];
      if (!d || !keyDirs.current.has(d)) return;
      keyDirs.current.delete(d);
      update();
    };
    const blur = () => {
      if (!keyDirs.current.size && !btnDir.current) return;
      keyDirs.current.clear();
      btnDir.current = null;
      update();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [disabled, update]);

  const press = (dir) => (e) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    btnDir.current = dir;
    update();
  };
  const lift = () => {
    if (!btnDir.current) return;
    btnDir.current = null;
    update();
  };

  const btn = (dir, label, Icon, area) => (
    <button
      key={dir}
      type="button"
      className={`dpad-btn ${active.has(dir) ? "active" : ""}`}
      style={{ gridArea: area }}
      onPointerDown={press(dir)}
      onPointerUp={lift}
      onPointerCancel={lift}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
      title={label}
    >
      <Icon size={20} />
    </button>
  );

  return (
    <div className={`dpad ${disabled ? "disabled" : ""}`}>
      <div className="dpad-grid">
        {btn("f", "Forward (W / ↑)", ArrowUp, "up")}
        {btn("l", "Left (A / ←)", ArrowLeft, "left")}
        <div className="dpad-center" style={{ gridArea: "mid" }}>
          <span>L <strong>{lr[0]}</strong></span>
          <span>R <strong>{lr[1]}</strong></span>
        </div>
        {btn("r", "Right (D / →)", ArrowRight, "right")}
        {btn("b", "Back (S / ↓)", ArrowDown, "down")}
      </div>
    </div>
  );
}
