import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { wsUrl } from "./api";

// One WebSocket for the whole app: live telemetry in, commands out.
const BoatContext = createContext(null);
const TRAIL_MAX = 600;
const ONLINE_TIMEOUT_MS = 20000;

export function BoatProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [lastSeenAt, setLastSeenAt] = useState(null);
  const [log, setLog] = useState([]);
  const [trail, setTrail] = useState([]);
  const [missionEvent, setMissionEvent] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const socketRef = useRef(null);

  useEffect(() => {
    let closed = false;
    let retry = null;

    const connect = () => {
      const socket = new WebSocket(wsUrl());
      socketRef.current = socket;

      socket.onopen = () => setConnected(true);
      socket.onclose = (event) => {
        setConnected(false);
        if (!closed && event.code !== 4401) retry = setTimeout(connect, 2000);
      };
      socket.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        const { type, data } = msg;
        if (type === "hello") {
          if (data.telemetry) setTelemetry(data.telemetry);
          if (data.lastSeenAt) setLastSeenAt(new Date(data.lastSeenAt).getTime());
          setLog(data.log || []);
        } else if (type === "telemetry") {
          setTelemetry(data);
          setLastSeenAt(Date.now());
          if (data.fix && Number.isFinite(data.lat) && Number.isFinite(data.lon)) {
            setTrail((t) => [...t.slice(-TRAIL_MAX + 1), [data.lat, data.lon]]);
          }
        } else if (type === "log") {
          setLog((l) => [data, ...l].slice(0, 100));
        } else if (type === "mission") {
          setMissionEvent({ ...data, seenAt: Date.now() });
        } else if (type === "error") {
          setLastError(data.message);
        }
      };
    };

    connect();
    const tick = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      closed = true;
      clearTimeout(retry);
      clearInterval(tick);
      socketRef.current?.close();
    };
  }, []);

  // Returns false when the socket is not open.
  const send = useCallback((command, args = {}) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type: "control", command, ...args }));
    return true;
  }, []);

  const online = Boolean(lastSeenAt) && now - lastSeenAt < ONLINE_TIMEOUT_MS;

  return (
    <BoatContext.Provider
      value={{
        connected,
        online,
        telemetry,
        lastSeenAt,
        secondsAgo: lastSeenAt ? Math.round((now - lastSeenAt) / 1000) : null,
        log,
        trail,
        clearTrail: () => setTrail([]),
        missionEvent,
        lastError,
        clearError: () => setLastError(null),
        send,
      }}
    >
      {children}
    </BoatContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useBoat = () => useContext(BoatContext);
