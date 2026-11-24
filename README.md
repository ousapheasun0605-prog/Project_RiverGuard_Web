# Project RiverGuard

RiverGuard is an autonomous river-cleaning boat. This repository is the web part: a dashboard to watch the boat live, drive it remotely over 4G, run GPS missions (A → B → A), and review mission history.

## Quick start (one command)

You need **Docker Desktop** (the script offers to install it with Homebrew on a Mac).

```bash
./run.sh          # real boat (MQTT broker from .env)
./run.sh --sim    # simulated boat, no hardware needed
```

The first run creates `.env` with random secrets and prints the admin login. Then open **http://localhost:8080**.

| Command | What it does |
|---|---|
| `./run.sh` | Build and start everything, connected to the real boat |
| `./run.sh --sim` | Same, but with a fake boat on a local MQTT broker |
| `./run.sh logs` | Follow the backend (and simulator) logs |
| `./run.sh status` | Show running containers |
| `./run.sh stop` | Stop everything (data is kept) |
| `./run.sh reset` | Stop and delete the database |

## Technology stack

- **Frontend:** React 19, Vite, React Router, Leaflet (map), Recharts, served by nginx
- **Backend:** Node.js 22, Express 5, Prisma 7, PostgreSQL 16, JWT login
- **Boat link:** MQTT (boat ⇄ backend), WebSocket (backend ⇄ browser)
- **Docker Compose:** `db` (Postgres), `mosquitto` (local MQTT), `backend`, `web`, `simulator` (only with `--sim`)

## Pages

- **Dashboard:** live map, battery, speed, GPS, mission control (pick B on the map → start, return home, stop) and live activity.
- **Control:** remote control. Joystick or W A S D / arrow keys, big STOP button (or Esc), set home, send target B, Go, Return home, auto speed, wait time, compass calibration, full telemetry.
- **Missions:** mission history from the database with GPS track, distance, duration and commands.
- **Analytics:** totals, distance per mission, distance per day, AI waste detections (when uploaded).
- **Users (admin):** add or deactivate operator accounts.

## How the website talks to the boat

The backend speaks the same MQTT protocol as the ESP32-S3 firmware (`riverguard_boat_esp32`):

| Topic | Direction | Content |
|---|---|---|
| `riverguard-itc/telemetry` | boat → web | JSON: `mode, lat, lon, fix, sats, spd, hdg, v, a, batP, lte, home, tgt, dist, msg ...` |
| `riverguard-itc/cmd` | web → boat | Text: `stop`, `drive <l> <r>`, `home`, `target <lat> <lon>`, `go`, `rth`, `calh`, `cals`, `speed <n>`, `wait <min>` |

The broker and topic prefix are set in `.env` (`MQTT_BROKER_URL`, `BOAT_TOPIC_PREFIX`) and must match `MQTT_BROKER`, `TOPIC_TELE` and `TOPIC_CMD` in the firmware `config.h`.

- **Missions:** the firmware has no acknowledgements, so the backend watches the boat's `mode`. A mission becomes ACTIVE when the boat enters `GO_TO_B`, COMPLETED when it reaches `HOLD` at home, and STOPPED on `IDLE`/`MANUAL`. If the boat doesn't start within 30 s, the start fails with the boat's message (for example "Set home A first").
- **Manual drive:** the browser sends `drive` about 4 times a second. The firmware stops the motors by itself 1 s after the last drive command, so a lost connection stops the boat.
- **Online/offline:** the boat counts as offline after 20 s without telemetry.
- The older `robot/1/*` JSON protocol with acknowledgements is still available with `BOAT_PROTOCOL=json`.

### Tips for the firmware

- Telemetry is sent every `TELE_MS` (5000 ms). For a smoother live map use 1000–2000 ms.
- `broker.hivemq.com` is public: anyone who knows the topic can read the telemetry and send commands. Before real field use, switch to a private broker with a username and password (HiveMQ Cloud / EMQX free tier) in both `config.h` and `.env`.

## Running without Docker (development)

```bash
# Backend
cd Backend
cp .env.example .env        # edit DATABASE_URL etc.
npm install
npx prisma migrate deploy
npm run seed                # robot + first admin from .env
npm run dev                 # http://localhost:5000
npm run simulate            # optional fake boat (needs a local MQTT broker)

# Frontend
cd Frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api and /ws to :5000)
```

## Repository structure

- `Frontend/`: web dashboard (React)
- `Backend/`: API, database, MQTT bridge, WebSocket, boat simulator (`tools/boat_simulator.js`)
- `mosquitto/`: local MQTT broker config
- `docker-compose.yml`, `run.sh`, `.env.example`: one-command setup
- `docs/`: project documentation

## Team workflow

Feature branches are merged into `develop` for integration and testing. Stable versions are merged into `main`. See `docs/branch-strategy.md`.

## Pi camera stream

1. Copy `pi/setup_camera.sh` to the Raspberry Pi and run `bash setup_camera.sh`. It installs MediaMTX as a service that starts on boot.
2. Open `http://<pi-ip>:8889/cam` on the Mac to check the video.
3. Paste that link in the dashboard Camera panel (pencil button), or set `CAMERA_URL` in `.env` for everyone.

Only one program can use the Pi camera at a time, so stop the detection script while streaming (or have it read from MediaMTX's RTSP stream `rtsp://<pi-ip>:8554/cam`). Over 4G the Pi needs its own internet (USB dongle or pocket Wi-Fi) and the Mac must reach it, for example with Tailscale.
