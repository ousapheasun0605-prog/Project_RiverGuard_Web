// Fake RiverGuard boat for testing the website without hardware.
// Speaks the same MQTT protocol as firmware/riverguard_boat_esp32:
//   subscribes <prefix>/cmd (plain text), publishes <prefix>/telemetry (JSON).
// Run: node tools/boat_simulator.js   (uses MQTT_BROKER_URL and BOAT_TOPIC_PREFIX)
import "dotenv/config";
import mqtt from "mqtt";

const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://127.0.0.1:1883";
const prefix = process.env.BOAT_TOPIC_PREFIX || "riverguard-itc";
const TELE_MS = Number(process.env.SIM_TELE_MS || 1000);
const MAX_PCT = 50;
const MANUAL_TIMEOUT_MS = 1000;

const s = {
  mode: "IDLE",
  lat: Number(process.env.SIM_LAT || 11.5564),
  lon: Number(process.env.SIM_LON || 104.9282),
  hdg: 90,
  spd: 0,
  v: 7.9,
  homeSet: false, hlat: 0, hlon: 0,
  tgtSet: false, tlat: 0, tlon: 0,
  cal: true,
  cruise: 30,
  waitMin: 0,
  waitUntil: 0,
  l: 0, r: 0,
  manL: 0, manR: 0, lastManual: 0,
  msg: "Simulator ready",
  start: Date.now(),
};

const say = (m) => { s.msg = m; console.log("BOAT:", m); };
const toRad = (d) => (d * Math.PI) / 180;
const dist = (aLat, aLon, bLat, bLon) => {
  const R = 6371000;
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const bearing = (aLat, aLon, bLat, bLon) => {
  const y = Math.sin(toRad(bLon - aLon)) * Math.cos(toRad(bLat));
  const x = Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) - Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(toRad(bLon - aLon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

function command(line) {
  const [c0, a1, a2] = line.trim().split(/\s+/);
  const c = (c0 || "").toLowerCase();
  if (c === "stop") { s.mode = "IDLE"; say("STOP"); }
  else if (c === "drive") {
    if (s.mode !== "MANUAL") { s.mode = "MANUAL"; say("MANUAL"); }
    s.lastManual = Date.now();
    s.manL = (parseInt(a1, 10) || 0) * MAX_PCT / 100;
    s.manR = (parseInt(a2, 10) || 0) * MAX_PCT / 100;
  }
  else if (c === "home") { s.hlat = s.lat; s.hlon = s.lon; s.homeSet = true; say("Home A set"); }
  else if (c === "target") { s.tlat = parseFloat(a1); s.tlon = parseFloat(a2); s.tgtSet = true; say("Target B set"); }
  else if (c === "go") {
    if (!s.homeSet) return say("Set home A first");
    if (!s.tgtSet) return say("Pin B first");
    s.mode = "GO_TO_B"; say("GOING TO B");
  }
  else if (c === "rth") {
    if (!s.homeSet) return say("No home set");
    s.mode = "RETURN_HOME"; say("RETURNING HOME");
  }
  else if (c === "calh" || c === "cals") { s.mode = c === "calh" ? "CAL_HAND" : "CAL_SPIN"; s.calEnd = Date.now() + 5000; say("CAL started (sim 5 s)"); }
  else if (c === "speed") { s.cruise = Math.max(10, Math.min(MAX_PCT, parseInt(a1, 10) || 30)); say(`Auto speed ${s.cruise}%`); }
  else if (c === "wait") { s.waitMin = Math.max(0, Math.min(30, parseInt(a1, 10) || 0)); say(`Wait at B ${s.waitMin} min`); }
  else if (c) say(`Unknown command: ${c}`);
}

function steer(goalLat, goalLon) {
  const d = dist(s.lat, s.lon, goalLat, goalLon);
  const brg = bearing(s.lat, s.lon, goalLat, goalLon);
  let err = ((brg - s.hdg + 540) % 360) - 180;
  const turn = Math.max(-30, Math.min(30, err * 0.8));
  s.l = Math.round(s.cruise + turn);
  s.r = Math.round(s.cruise - turn);
  return { d, brg };
}

let goal = { d: -1, brg: 0 };

function physics(dt) {
  goal = { d: -1, brg: 0 };
  if (s.mode === "MANUAL") {
    if (Date.now() - s.lastManual > MANUAL_TIMEOUT_MS) { s.mode = "IDLE"; say("Manual timeout - stop"); }
    s.l = Math.round(s.manL); s.r = Math.round(s.manR);
  } else if (s.mode === "GO_TO_B") {
    goal = steer(s.tlat, s.tlon);
    if (goal.d < 4) {
      s.mode = "WAIT_AT_B"; s.waitUntil = Date.now() + s.waitMin * 60000;
      say(`At B, waiting ${s.waitMin} min`);
    }
  } else if (s.mode === "WAIT_AT_B") {
    s.l = s.r = 0;
    if (Date.now() >= s.waitUntil) { s.mode = "RETURN_HOME"; say("RETURNING HOME"); }
  } else if (s.mode === "RETURN_HOME") {
    goal = steer(s.hlat, s.hlon);
    if (goal.d < 4) { s.mode = "HOLD"; say("Home reached - HOLD"); }
  } else if (s.mode === "CAL_HAND" || s.mode === "CAL_SPIN") {
    s.l = 20; s.r = -20;
    if (Date.now() > s.calEnd) { s.mode = "IDLE"; s.cal = true; say("Compass calibrated"); }
  } else {
    s.l = s.r = 0;
  }

  // Simple boat model: thrust -> speed (m/s), difference -> turn.
  const thrust = (s.l + s.r) / 2;
  const target = thrust * 0.05; // 50% -> 2.5 m/s
  const mps = s.spd / 3.6;
  const newMps = mps + (target - mps) * Math.min(1, dt * 1.5);
  s.spd = Math.max(0, newMps * 3.6);
  s.hdg = (s.hdg + (s.l - s.r) * 1.2 * dt + 360) % 360;

  const moved = newMps * dt;
  s.lat += (moved * Math.cos(toRad(s.hdg))) / 111320;
  s.lon += (moved * Math.sin(toRad(s.hdg))) / (111320 * Math.cos(toRad(s.lat)));

  s.v = Math.max(6.6, s.v - (Math.abs(s.l) + Math.abs(s.r)) * 0.00002 * dt);
}

function status() {
  const batP = Math.round(Math.max(0, Math.min(100, ((s.v - 6.6) / (8.4 - 6.6)) * 100)));
  return {
    mode: s.mode, act: s.mode === "MANUAL" ? "joystick" : s.mode.toLowerCase(), fix: true,
    lat: Number(s.lat.toFixed(7)), lon: Number(s.lon.toFixed(7)), sats: 9, hdop: 0.9,
    spd: Number(s.spd.toFixed(1)), hdg: Math.round(s.hdg), cmp: true, cal: s.cal, roll: 0, pitch: 0,
    ina: true, v: Number(s.v.toFixed(2)), a: Number(((Math.abs(s.l) + Math.abs(s.r)) * 0.08).toFixed(2)), batP,
    lte: "MQTT up", csq: 24, net: "LTE", band: "BAND3", oper: "456-08", rsrp: -86, rsrq: -9.5, sinr: 14,
    home: s.homeSet, hlat: s.hlat, hlon: s.hlon, tgt: s.tgtSet, tlat: s.tlat, tlon: s.tlon,
    dist: Number(goal.d.toFixed(1)), brg: Math.round(goal.brg),
    wait: s.mode === "WAIT_AT_B" ? Math.max(0, Math.round((s.waitUntil - Date.now()) / 1000)) : 0,
    waitMin: s.waitMin, speed: s.cruise, l: s.l, r: s.r,
    up: Math.round((Date.now() - s.start) / 1000), msg: s.msg,
  };
}

const client = mqtt.connect(brokerUrl, {
  clientId: `riverguard-sim-${Math.random().toString(16).slice(2, 8)}`,
  reconnectPeriod: 3000,
});

client.on("connect", () => {
  console.log(`Simulator connected to ${brokerUrl}, topics ${prefix}/telemetry and ${prefix}/cmd`);
  client.subscribe(`${prefix}/cmd`, { qos: 1 });
});
client.on("message", (_topic, payload) => command(payload.toString()));
client.on("error", (e) => console.error("Simulator MQTT error:", e.message));

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  physics((now - last) / 1000);
  last = now;
}, 100);

setInterval(() => {
  if (client.connected) client.publish(`${prefix}/telemetry`, JSON.stringify(status()));
}, TELE_MS);
