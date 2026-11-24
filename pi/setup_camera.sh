#!/usr/bin/env bash
# RiverGuard: stream the Pi camera to the dashboard with MediaMTX.
# Run on the Raspberry Pi (64-bit Raspberry Pi OS):
#   bash setup_camera.sh
# Then open http://<pi-ip>:8889/cam in a browser.
set -euo pipefail

W=${CAM_WIDTH:-640}
H=${CAM_HEIGHT:-480}
FPS=${CAM_FPS:-15}
BITRATE=${CAM_BITRATE:-800000}   # bits/s, ~0.8 Mbps (keep low for 4G)

ARCH=$(uname -m)
case "$ARCH" in
  aarch64) PKG=linux_arm64 ;;
  armv7l)  PKG=linux_armv7 ;;
  *) echo "Unsupported CPU: $ARCH (use 64-bit Raspberry Pi OS)"; exit 1 ;;
esac

echo "== Checking the camera"
if command -v rpicam-hello >/dev/null 2>&1; then
  rpicam-hello --list-cameras || true
elif command -v libcamera-hello >/dev/null 2>&1; then
  libcamera-hello --list-cameras || true
fi

echo "== Downloading MediaMTX ($PKG)"
URL=$(curl -fsSL https://api.github.com/repos/bluenviron/mediamtx/releases/latest \
  | grep -o "https://[^\"]*_${PKG}\.tar\.gz" | head -n 1)
[ -n "$URL" ] || { echo "Could not find a MediaMTX download for $PKG"; exit 1; }
echo "$URL"
TMP=$(mktemp -d)
curl -fsSL "$URL" -o "$TMP/mediamtx.tar.gz"
tar -xzf "$TMP/mediamtx.tar.gz" -C "$TMP"
sudo install -m 755 "$TMP/mediamtx" /usr/local/bin/mediamtx
rm -rf "$TMP"

echo "== Writing /etc/mediamtx.yml"
sudo tee /etc/mediamtx.yml >/dev/null <<YML
# RiverGuard camera. Viewer page: http://<pi-ip>:8889/cam
logLevel: info
rtsp: yes
rtmp: no
hls: yes
webrtc: yes
srt: no
webrtcAddress: :8889
hlsAddress: :8888

paths:
  cam:
    source: rpiCamera
    rpiCameraWidth: ${W}
    rpiCameraHeight: ${H}
    rpiCameraFPS: ${FPS}
    rpiCameraBitrate: ${BITRATE}
YML

echo "== Installing the service (starts on boot)"
sudo tee /etc/systemd/system/mediamtx.service >/dev/null <<'SVC'
[Unit]
Description=MediaMTX camera stream (RiverGuard)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/mediamtx /etc/mediamtx.yml
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SVC

sudo systemctl daemon-reload
sudo systemctl enable --now mediamtx
sleep 3
sudo systemctl --no-pager --lines=15 status mediamtx || true

IP=$(hostname -I | awk '{print $1}')
echo
echo "Done. Open this on your Mac (same Wi-Fi):"
echo "  http://${IP}:8889/cam"
echo "Put that link in the dashboard Camera panel."
echo "Logs: journalctl -u mediamtx -f"
