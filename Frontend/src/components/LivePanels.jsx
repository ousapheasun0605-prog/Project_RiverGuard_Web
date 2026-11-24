import { Activity, ShieldCheck } from "lucide-react";
import { useBoat } from "../lib/boat";

const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--";

export function ConnectionBadge() {
  const { connected, online, secondsAgo, telemetry } = useBoat();
  let text = "Server disconnected";
  let cls = "offline";
  if (connected && online) {
    text = `Boat online · ${telemetry?.mode || "?"} · ${secondsAgo}s ago`;
    cls = "online";
  } else if (connected) {
    text = secondsAgo != null ? `Boat offline · last seen ${secondsAgo}s ago` : "Waiting for boat telemetry";
    cls = "waiting";
  }
  return (
    <div className="connection-status">
      <span className={`status-dot ${cls}`} />
      <span>{text}</span>
    </div>
  );
}

export function ActivityLog({ limit = 15, title = "Live activity" }) {
  const { log } = useBoat();
  return (
    <section className="panel command-panel">
      <div className="panel-heading command-panel-heading">
        <div>
          <h2>{title}</h2>
          <p>Commands sent and messages from the boat</p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="command-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Command / Activity</th>
              <th>From</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {log.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">No activity yet</td>
              </tr>
            )}
            {log.slice(0, limit).map((item) => (
              <tr key={item.id}>
                <td>{fmtTime(item.at)}</td>
                <td>
                  <span className="command-name">
                    <Activity size={15} />
                    {item.text}
                  </span>
                </td>
                <td>{item.kind === "command" ? item.user : item.kind === "boat" ? "Boat" : "System"}</td>
                <td>
                  <span className={`log-kind ${item.kind}`}>
                    <ShieldCheck size={14} />
                    {item.kind}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
