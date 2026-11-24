import { useEffect, useState } from "react";
import { Camera, Pencil, RefreshCw } from "lucide-react";
import api from "../lib/api";

// Shows the Pi camera stream (MediaMTX WebRTC page, e.g. http://192.168.1.50:8889/cam).
// The link comes from CAMERA_URL in .env; each viewer can override it here.
const KEY = "riverguard_camera_url";

const readSaved = () => {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
};

const withPlayerOptions = (url) => {
  if (!url) return "";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}controls=false&muted=true&autoplay=true&playsinline=true`;
};

export default function CameraPanel({ className = "" }) {
  const [saved, setSaved] = useState(readSaved);
  const [serverUrl, setServerUrl] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api
      .get("/config")
      .then((res) => setServerUrl(res.data.cameraUrl || ""))
      .catch(() => {});
  }, []);

  const url = saved || serverUrl;

  const save = (event) => {
    event.preventDefault();
    const value = draft.trim();
    try {
      if (value) localStorage.setItem(KEY, value);
      else localStorage.removeItem(KEY);
    } catch {
      /* storage blocked */
    }
    setSaved(value);
    setEditing(false);
  };

  return (
    <article className={`panel camera-panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>Camera</h2>
          <p>Live view from the Pi camera</p>
        </div>
        <div className="camera-actions">
          <button type="button" className="small-button secondary" onClick={() => setReloadKey((k) => k + 1)} disabled={!url} title="Reload stream">
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            className="small-button secondary"
            onClick={() => {
              setDraft(url);
              setEditing((e) => !e);
            }}
            title="Change camera link"
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>

      {editing && (
        <form className="camera-form" onSubmit={save}>
          <input
            type="url"
            placeholder="http://<pi-ip>:8889/cam"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="small-button primary">Save</button>
        </form>
      )}

      <div className="camera-frame">
        {url ? (
          <iframe
            key={reloadKey}
            src={withPlayerOptions(url)}
            title="Pi camera"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="camera-empty">
            <Camera size={26} />
            <strong>No camera link yet</strong>
            <span>Run pi/setup_camera.sh on the Pi, then press the pencil and paste http://&lt;pi-ip&gt;:8889/cam</span>
          </div>
        )}
      </div>
    </article>
  );
}
