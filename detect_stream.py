#!/usr/bin/env python3
"""RiverGuard: Pi camera -> YOLO object detection -> live video with boxes for the dashboard.

Run on the Raspberry Pi (stop MediaMTX first, only one program can use the camera):
    sudo systemctl stop mediamtx
    python3 detect_stream.py                      # default yolov8n.pt (downloads once)
    python3 detect_stream.py --model best.pt      # your own trained model

Then paste  http://<pi-ip>:8000/  in the dashboard Camera panel (pencil button).

Pages:
    /                 video page for the dashboard (fits the panel)
    /stream           raw MJPEG stream
    /snapshot.jpg     one picture
    /detections.json  latest detections
"""
import argparse
import json
import os
import socketserver
import threading
import time
from http import server

import cv2
from picamera2 import Picamera2
from ultralytics import YOLO

p = argparse.ArgumentParser()
p.add_argument("--model", default="yolov8n.pt", help="YOLO model file (.pt, or exported _ncnn_model folder)")
p.add_argument("--width", type=int, default=640)
p.add_argument("--height", type=int, default=480)
p.add_argument("--imgsz", type=int, default=320, help="YOLO input size (smaller = faster)")
p.add_argument("--conf", type=float, default=0.4, help="minimum confidence 0..1")
p.add_argument("--port", type=int, default=8000)
p.add_argument("--quality", type=int, default=70, help="JPEG quality 1..100 (lower = less 4G data)")
args = p.parse_args()

# ---------------------------------------------------------------- shared state
lock = threading.Condition()
latest_jpeg = None
latest_dets = {"fps": 0, "objects": []}


def publish(jpeg, dets):
    global latest_jpeg, latest_dets
    with lock:
        latest_jpeg = jpeg
        latest_dets = dets
        lock.notify_all()


# ---------------------------------------------------------------- detection loop
def detect_loop():
    try:
        run_detection()
    except Exception as e:  # camera busy, model missing ... stop the whole program
        print(f"ERROR: {e}")
        print("If the camera is busy: sudo systemctl stop mediamtx (and stop other camera scripts)")
        os._exit(1)


def run_detection():
    print(f"Loading model {args.model} ...")
    model = YOLO(args.model)
    names = model.names

    cam = Picamera2()
    cam.configure(cam.create_video_configuration(
        main={"size": (args.width, args.height), "format": "RGB888"}))
    cam.start()
    time.sleep(1)
    print("Camera started")

    fps = 0.0
    while True:
        t0 = time.time()
        frame = cam.capture_array()  # "RGB888" in picamera2 is BGR order, ready for OpenCV

        result = model.predict(frame, imgsz=args.imgsz, conf=args.conf, verbose=False)[0]
        objects = []
        for box in result.boxes:
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
            label = names[int(box.cls[0])]
            conf = float(box.conf[0])
            objects.append({
                "label": label, "conf": round(conf, 2),
                "x": round(x1 / args.width, 3), "y": round(y1 / args.height, 3),
                "w": round((x2 - x1) / args.width, 3), "h": round((y2 - y1) / args.height, 3),
            })
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 200, 255), 2)
            text = f"{label} {conf:.0%}"
            (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(frame, (x1, max(0, y1 - th - 6)), (x1 + tw + 6, y1), (0, 200, 255), -1)
            cv2.putText(frame, text, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

        dt = time.time() - t0
        fps = 0.8 * fps + 0.2 * (1 / dt if dt > 0 else 0)
        cv2.putText(frame, f"{fps:.1f} fps  {len(objects)} objects", (8, 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

        ok, jpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, args.quality])
        if ok:
            publish(jpg.tobytes(), {"fps": round(fps, 1), "time": time.time(), "objects": objects})


# ---------------------------------------------------------------- web server
PAGE = b"""<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RiverGuard camera</title>
<style>html,body{margin:0;height:100%;background:#000}
img{width:100%;height:100%;object-fit:contain;display:block}</style></head>
<body><img src="/stream" alt="RiverGuard camera"></body></html>"""


class Handler(server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send_body(self, ctype, body):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]  # dashboard adds ?controls=... to the link
        if path in ("/", "/index.html", "/cam"):
            return self.send_body("text/html", PAGE)
        if path == "/detections.json":
            with lock:
                return self.send_body("application/json", json.dumps(latest_dets).encode())
        if path == "/snapshot.jpg":
            with lock:
                if latest_jpeg is None:
                    return self.send_error(503, "camera starting")
                return self.send_body("image/jpeg", latest_jpeg)
        if path == "/stream":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                while True:
                    with lock:
                        lock.wait(timeout=5)
                        jpeg = latest_jpeg
                    if jpeg is None:
                        continue
                    self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\n")
                    self.wfile.write(f"Content-Length: {len(jpeg)}\r\n\r\n".encode())
                    self.wfile.write(jpeg)
                    self.wfile.write(b"\r\n")
            except (BrokenPipeError, ConnectionResetError):
                pass
            return None
        self.send_error(404)


class Server(socketserver.ThreadingMixIn, server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    threading.Thread(target=detect_loop, daemon=True).start()
    print(f"Open http://<pi-ip>:{args.port}/ (paste it in the dashboard Camera panel)")
    Server(("", args.port), Handler).serve_forever()
