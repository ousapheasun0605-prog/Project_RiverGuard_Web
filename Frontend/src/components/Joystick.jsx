import { useCallback, useEffect, useRef, useState } from "react";

// Touch/mouse joystick + keyboard (W A S D / arrow keys).
// Calls onDrive(l, r) about 4 times a second while held, onRelease() when let go.
// Firmware stops the motors by itself if no drive command arrives for 1 s.
const SEND_MS = 250;

const mix = (x, y) => {
  // y forward (+) / back (-), x right (+) / left (-), both -1..1
  const l = Math.max(-1, Math.min(1, y + x));
  const r = Math.max(-1, Math.min(1, y - x));
  return [Math.round(l * 100), Math.round(r * 100)];
};

export default function Joystick({ onDrive, onRelease, disabled, power = 100 }) {
  const padRef = useRef(null);
  const vec = useRef({ x: 0, y: 0, active: false });
  const keys = useRef(new Set());
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });
  const [lr, setLr] = useState([0, 0]);

  const scaled = useCallback(() => {
    const [l, r] = mix(vec.current.x, vec.current.y);
    return [Math.round((l * power) / 100), Math.round((r * power) / 100)];
  }, [power]);

  // Send loop while active.
  useEffect(() => {
    const id = setInterval(() => {
      if (!vec.current.active || disabled) return;
      const [l, r] = scaled();
      setLr([l, r]);
      onDrive?.(l, r);
    }, SEND_MS);
    return () => clearInterval(id);
  }, [onDrive, disabled, scaled]);

  const release = useCallback(() => {
    if (!vec.current.active) return;
    vec.current = { x: 0, y: 0, active: false };
    setKnob({ x: 0, y: 0, active: false });
    setLr([0, 0]);
    onRelease?.();
  }, [onRelease]);

  const moveTo = (clientX, clientY) => {
    const rect = padRef.current.getBoundingClientRect();
    const radius = rect.width / 2;
    let dx = (clientX - (rect.left + radius)) / radius;
    let dy = (clientY - (rect.top + radius)) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    vec.current = { x: dx, y: -dy, active: true };
    setKnob({ x: dx, y: dy, active: true });
  };

  const onPointerDown = (e) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(e.clientX, e.clientY);
    const [l, r] = scaled();
    onDrive?.(l, r);
  };
  const onPointerMove = (e) => {
    if (vec.current.active && !keys.current.size) moveTo(e.clientX, e.clientY);
  };

  // Keyboard driving.
  useEffect(() => {
    const map = {
      ArrowUp: "f", KeyW: "f", ArrowDown: "b", KeyS: "b",
      ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r",
    };
    const apply = () => {
      const k = keys.current;
      const y = (k.has("f") ? 1 : 0) - (k.has("b") ? 1 : 0);
      const x = (k.has("r") ? 0.7 : 0) - (k.has("l") ? 0.7 : 0);
      if (!k.size) return release();
      vec.current = { x, y, active: true };
      setKnob({ x, y: -y, active: true });
    };
    const isTyping = (e) => ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
    const down = (e) => {
      if (disabled || isTyping(e) || !map[e.code]) return;
      e.preventDefault();
      if (e.code === "Space") return;
      keys.current.add(map[e.code]);
      apply();
    };
    const up = (e) => {
      if (!map[e.code]) return;
      keys.current.delete(map[e.code]);
      apply();
    };
    const blur = () => {
      keys.current.clear();
      release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [disabled, release]);

  return (
    <div className={`joystick ${disabled ? "disabled" : ""}`}>
      <div
        ref={padRef}
        className="joystick-pad"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        role="application"
        aria-label="Drive joystick"
      >
        <span className="joystick-label top">FWD</span>
        <span className="joystick-label bottom">REV</span>
        <div
          className={`joystick-knob ${knob.active ? "active" : ""}`}
          style={{ transform: `translate(${knob.x * 46}px, ${knob.y * 46}px)` }}
        />
      </div>
      <div className="joystick-readout">
        <span>L <strong>{lr[0]}</strong></span>
        <span>R <strong>{lr[1]}</strong></span>
      </div>
    </div>
  );
}
